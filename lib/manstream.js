/*
 * Copyright 2015 Joshua M. Clulow <josh@sysmgr.org>
 */

var mod_util = require('util');
var mod_stream = require('stream');

function
anchor_name(inp)
{
	var out = inp.trim().toLowerCase();

	out = out.replace(/ /g, '-');
	out = out.replace(/_/g, '-');

	return (out);
}

function
ManStream()
{
	this.mans_count = 0;

	mod_stream.Transform.call(this, {
		objectMode: true,
		highWaterMark: 0
	});
}
mod_util.inherits(ManStream, mod_stream.Transform);

ManStream.prototype._transform = function
_transform(ch, enc, done)
{
	var m;

	/*
	 * Replace manual cross-references with hyperlinks.  We ignore the
	 * first line, as it is almost certainly a heading containing something
	 * that _looks like_, but is _not_, a cross-reference.
	 */
	if (this.mans_count++ > 0) {
		ch = ch.replace(/<b>([.a-zA-Z0-9_-]{2,})<\/b>\(([0-9A-Z]+)\)/g,
		    '<a href="/man/$2/$1">$1($2)</a>');
		ch = ch.replace(/<b>([.a-zA-Z0-9_-]{2,})\(([0-9A-Z]+)\)<\/b>/g,
		    '<a href="/man/$2/$1">$1($2)</a>');
		ch = ch.replace(/([a-zA-Z][a-zA-Z0-9_.-]+)\(([0-9A-Z]+)\)/g,
		    '<a href="/man/$2/$1">$1($2)</a>');
	}

	if ((m = ch.match(/^<b>([A-Z ]+)<\/b>$/))) {
		/*
		 * Format a top-level manual heading, e.g., "SYNOPSIS",
		 * "EXAMPLES", "SEE ALSO", etc.
		 */
		this.push('<a name="' + anchor_name(m[1]) + '"><h2>' + m[1] +
		    '</h2></a><br>');
	} else if ((m = ch.match(/^   <b>([A-Z][a-zA-Z ]+)<\/b>$/))) {
		/*
		 * Format a second-level manual heading, e.g., "SUBCOMMANDS",
		 * "Options".
		 */
		this.push('<a name="' + anchor_name(m[1]) + '"><h3>   ' + m[1] +
		    '</h3></a><br>');
	} else if ((m = ch.match(/^       <b>Example ([0-9]+) *<\/b>(.*)$/))) {
		/*
		 * Format an example heading, e.g., "Example 20".
		 */
		this.push('<a name="' + anchor_name('example-' + m[1]) +
		    '"><h4>       Example ' + m[1] + ': ' + m[2] + '</h4>' +
		    '</a><br>');
	} else {
		this.push(ch + '<br>');
	}

	done();
};

module.exports = {
	ManStream: ManStream
};

/* vim: set ts=8 sts=8 sw=8 noet: */
