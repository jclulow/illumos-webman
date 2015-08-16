/*
 * Copyright 2015 Joshua M. Clulow <josh@sysmgr.org>
 */

var mod_fs = require('fs');
var mod_path = require('path');

var mod_assert = require('assert-plus');
var mod_vasync = require('vasync');

var SECTIONS = {
	'1': 'Commands',
	'2': 'System Calls',
	'3': 'Libraries',
	'4': 'File Formats',
	'5': 'Standards, Environments, and Macros',
	'6': 'There Is Nooooooooo... Section 6',
	'7': 'Device and Network Interfaces',
	'8': 'This Section Intentionally Left Blank',
	'9': 'Driver Entry Points'
};

var SUBSECTIONS = {
	'1': 'User Commands',
	'1b': 'SunOS/BSD Compatibility Package Commands',
	'1c': 'Communication Commands',
	'1m': 'Maintenance Commands',
	'2': 'System Calls',
	'3': 'Introduction to Library Functions',
	'3bsm': 'Security and Auditing Library Functions',
	'3c': 'Standard C Library Functions',
	'3cfgadm': 'Configuration Administration Library Functions',
	'3contract': 'Contract Subsystem Interfaces',
	'3curses': 'Curses Library Functions',
	'3xnet': 'X/Open Networking Interfaces',
	'3libucb': 'SunOS/BSD Compatibility Libraries',
	'4': 'File Formats',
	'5': 'Standards, Environments, and Macros',
	'7': 'Device and Network Interfaces',
	'7d': 'Devices',
	'7fs': 'File Systems',
	'7i': 'ioctl Requests',
	'7ipp': 'Miscellaneous References',
	'7m': 'STREAMS Modules',
	'7p': 'Protocols',
	'9e': 'Driver Entry Points',
	'9f': 'Kernel Functions',
	'9p': 'Driver Properties',
	'9s': 'Data Structures',
};

function
Mandir(dirs)
{
	this.md_dirs = [];

	this.md_sections = [];
	this.md_subsections = [];
}

Mandir.prototype.add_mandir = function
add_mandir(dir, cb)
{
	var self = this;

	mod_assert.ok(self.md_dirs.indexOf(dir) === -1);
	self.md_dirs.push(dir);

	mod_fs.readdir(dir, function (err, ents) {
		if (err) {
			cb(err);
			return;
		}

		for (var i = 0; i < ents.length; i++) {
			var ent = ents[i];
			var m = ent.match(/^man([0-9][a-zA-Z0-9]*)$/);

			if (!m) {
				continue;
			}

			var sect = m[1].substr(0, 1);
			var subsect = m[1];

			if (self.md_sections.indexOf(sect) === -1) {
				self.md_sections.push(sect);
			}
			if (self.md_subsections.indexOf(subsect) === -1) {
				self.md_subsections.push(subsect);
			}
		}
		self.md_sections.sort();
		self.md_subsections.sort();

		cb();
	});
};

Mandir.prototype.is_section = function
is_section(sectname)
{
	var sn = (sectname || '').trim().toLowerCase();

	return (this.md_subsections.indexOf(sn) !== -1);
};

Mandir.prototype.index = function
index()
{
	var self = this;
	var toc = [];

	for (var i = 0; i < self.md_sections.length; i++) {
		var sect = self.md_sections[i];
		var o = {
			name: sect,
			title: SECTIONS[sect] || null,
			subsections: []
		};

		for (var j = 0; j < self.md_subsections.length; j++) {
			var subsect = self.md_subsections[j];

			if (subsect.substr(0, 1) !== sect) {
				continue;
			}

			o.subsections.push({
				name: subsect,
				title: SUBSECTIONS[subsect] || null
			});
		}

		toc.push(o);
	}

	return (toc);
};

Mandir.prototype.pages = function
pages(sect, cb)
{
	var self = this;
	var pagelist = [];

	sect = sect.trim().toLowerCase();
	var re = new RegExp('\.' + sect + '$');

	var proc_dir = function (dir, next) {
		var thisdir = mod_path.join(dir, 'man' + sect);

		mod_fs.readdir(thisdir, function (err, ents) {
			if (err) {
				next(err);
				return;
			}

			for (var i = 0; i < ents.length; i++) {
				var ent = ents[i].replace(re, '');

				if (pagelist.indexOf(ent) === -1) {
					pagelist.push(ent);
				}
			}

			next();
		});
	};

	mod_vasync.forEachPipeline({
		func: proc_dir,
		inputs: self.md_dirs
	}, function (err) {
		if (err) {
			cb(err);
			return;
		}

		pagelist.sort();

		var sect_title = SECTIONS[sect.substr(0, 1)];
		var subsect_title = SUBSECTIONS[sect];
		var title = null;
		if (sect.substr(0, 1) === sect) {
			/*
			 * This is, itself, a full section.
			 */
			title = sect_title;
		} else {
			title = sect_title;
			if (subsect_title) {
				if (title) {
					title += ': ' + subsect_title;
				} else {
					title = subsect_title;
				}
			}
		}

		cb(null, pagelist, title);
	});
};

Mandir.prototype.lookup = function
lookup(sect, page, cb)
{
	var self = this;

	if (sect) {
		sect = sect.trim().toLowerCase();
	}

	var files = [];
	for (var i = 0; i < self.md_dirs.length; i++) {
		var dir = self.md_dirs[i];
		var sects = sect ? [ sect ] : self.md_subsections;

		for (var j = 0; j < sects.length; j++) {
			var s = sects[j];

			var path = mod_path.join(dir, 'man' + s, page +
			    '.' + s);

			if (files.indexOf(path) === -1) {
				files.push(path);
			}
		}
	}

	var keep_trying = function () {
		if (files.length < 1) {
			var ee = new Error('Page not found.');
			ee.code = 'ENOENT';
			cb(ee);
			return;
		}

		var file = files.shift();

		mod_fs.stat(file, function (err, st) {
			if (err) {
				if (err.code === 'ENOENT') {
					setImmediate(keep_trying);
					return;
				}
				cb(err);
				return;
			}

			cb(null, file);
		});
	};

	keep_trying();
};

function
create_mandir(mandirs, cb)
{
	mod_assert.arrayOfString(mandirs, 'mandirs');
	mod_assert.func(cb, 'cb');

	var md = new Mandir();
	mod_vasync.forEachPipeline({
		func: function (dir, next) {
			md.add_mandir(dir, next);
		},
		inputs: mandirs
	}, function (err) {
		if (err) {
			cb(err);
			return;
		}

		cb(null, md);
	});
}

module.exports = {
	create_mandir: create_mandir
};

/* vim: set ts=8 sts=8 sw=8 noet: */
