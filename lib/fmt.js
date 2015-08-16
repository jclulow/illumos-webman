/*
 * Copyright 2015 Joshua M. Clulow <josh@sysmgr.org>
 */

var mod_util = require('util');
var mod_stream = require('stream');


function
TeletypeStream()
{
	mod_stream.Transform.call(this, {
		objectMode: true,
		highWaterMark: 0
	});

	this.tts_line = '';
	this.tts_blanks = 0;

	this.tts_accum = '';
	this.tts_underline = 0;
	this.tts_bold = 0;
}
mod_util.inherits(TeletypeStream, mod_stream.Transform);

TeletypeStream.prototype.pushc = function
pushc(c)
{
	switch (c) {
	case '<':
		this.tts_line += '&lt;';
		return;
	case '>':
		this.tts_line += '&gt;';
		return;
	default:
		this.tts_line += c;
		return;
	}
};

TeletypeStream.prototype.set_underline = function
set_underline()
{
	if (this.tts_underline < 2) {
		if (this.tts_underline === 0) {
			this.reset_bold();
			this.tts_line += '<u>';
		}
		this.tts_underline = 2;
	}
};

TeletypeStream.prototype.set_bold = function
set_bold()
{
	if (this.tts_bold === 0) {
		this.tts_line += '<b>';
		this.tts_bold = 1;
	}
};

TeletypeStream.prototype.reset_bold = function
reset_bold()
{
	if (this.tts_bold > 0) {
		this.tts_line += '</b>';
		this.tts_bold = 0;
	}
};

TeletypeStream.prototype.reset_underline = function
reset_underline()
{
	if (this.tts_underline > 0) {
		this.reset_bold();
		this.tts_line += '</u>';
		this.tts_underline = 0;
	}
};

TeletypeStream.prototype.end_line = function
end_line()
{
	this.reset_bold();
	this.reset_underline();

	var blank = false;
	if (this.tts_line.trim() === '') {
		blank = true;
		this.tts_blanks++;
	} else {
		this.tts_blanks = 0;
	}

	if (!blank || this.tts_blanks < 3) {
		this.push(this.tts_line);
	}

	this.tts_line = '';
};

TeletypeStream.prototype.discard = function
discard(n)
{
	this.tts_accum = this.tts_accum.substr(n);
};

TeletypeStream.prototype._transform = function
_transform(chunk, enc, done)
{
	this.tts_accum += chunk.toString('utf8');

	while (this.tts_accum.length > 2) {
		var c = this.tts_accum[0];
		var cc = this.tts_accum[1];
		var ccc = this.tts_accum[2];

		if (c === '_' && ccc === '_' && cc === '\b' &&
		    this.tts_bold > 0) {
			/*
			 * This is probably an underscore within bold
			 * formatting.
			 */
			this.pushc(c);
			this.discard(3);
			continue;
		} else if (c === '_' && cc === '\b') {
			/*
			 * The next character is underlined.
			 */
			this.set_underline();
			this.discard(2);
			continue;
		}

		if (this.tts_underline === 1) {
			this.reset_underline();
		}

		if (c === '\n') {
			this.end_line();
			this.discard(1);
			continue;
		}

		if (cc === '\b' && c === ccc) {
			this.set_bold();
			this.pushc(c);
			this.discard(3);
		} else {
			if (c !== ' ') {
				this.reset_bold();
			}
			this.pushc(c);
			this.discard(1);
		}

		if (this.tts_underline === 2) {
			this.tts_underline = 1;
		}
	}

	done();
};

TeletypeStream.prototype._flush = function
_flush(done)
{
	while (this.tts_accum.length > 0) {
		var c = this.tts_accum[0];

		if (c === '\n') {
			this.end_line();
		} if (c !== '\b') {
			this.pushc(c);
		}

		this.discard(1);
	}

	if (this.tts_line.trim().length > 0) {
		this.end_line();
	}

	done();
};

module.exports = {
	TeletypeStream: TeletypeStream
};

/* vim: set ts=8 sts=8 sw=8 noet: */
