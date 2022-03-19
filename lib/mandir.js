/*
 * Copyright 2015 Joshua M. Clulow <josh@sysmgr.org>
 */

var mod_fs = require('fs');
var mod_path = require('path');

var mod_assert = require('assert-plus');
var mod_vasync = require('vasync');

var SECTIONS = {
	'1': 'User Commands',
	'2': 'System Calls',
	'3': 'Libraries',
	'4': 'Device and Network Interfaces',
	'5': 'File Formats and Configurations',
	'6': 'Games and Demos',
	'7': 'Standards, Environments, and Macros',
	'8': 'Maintenance Commands and Procedures',
	'9': 'Kernel Concepts',
};

var SUBSECTIONS = {
	'1': 'User Commands',
	'1B': 'BSD Compatibility Package Commands',
	'1C': 'Communication Commands',
	'1HAS': 'User Commands',
	'1ONBLD': 'illumos Build Tools',
	'1S': 'illumos Specific Commands',
	'2': 'System Calls',
	'3': 'Introduction to Library Functions',
	'3AVL': 'AVL Tree Library Functions',
	'3BSDMALLOC': 'BSD Memory Allocation Library',
	'3BSM': 'Security and Auditing Library Functions',
	'3C': 'Standard C Library Functions',
	'3C++': 'C++ Library Functions',
	'3C_DB': 'Threads Debugging Library Functions',
	'3CFGADM': 'Configuration Administration Library Functions',
	'3COMMPUTIL': 'Communication Protocol Parser Utilities ' +
	    'Library Functions',
	'3CONTRACT': 'Contract Management Library Functions',
	'3CPC': 'CPU Performance Counters Library Functions',
	'3CURSES': 'Curses Library Functions',
	'3DAT': 'Direct Access Transport Library Functions',
	'3DEVID': 'Device ID Library Functions',
	'3DEVINFO': 'Device Information Library Functions',
	'3DLPI': 'Data Link Provider Interface Library Functions',
	'3DNS_SD': 'DNS Service Discovery Library Functions',
	'3DOOR': 'Door Library Functions',
	'3ELF': 'ELF Library Functions',
	'3EXACCT': 'Extended Accounting File Access Library Functions',
	'3EXT': 'Extended Library Functions',
	'3FCOE': 'FCoE Port Management Library Functions',
	'3FSTYP': 'File System Type Identification Library Functions',
	'3GEN': 'String Pattern-Matching Library Functions',
	'3GSS': 'Generic Security Services API Library Functions',
	'3HEAD': 'Headers',
	'3ISCSIT': 'iSCSI Management Library Functions',
	'3KRB': 'Kerberos Library Functions',
	'3KRB5': 'MIT Kerberos 5 Library Functions',
	'3KSTAT': 'Kernel Statistics Library Functions',
	'3KVM': 'Kernel VM Library Functions',
	'3LDAP': 'LDAP Library Functions',
	'3LGRP': 'Locality Group Library Functions',
	'3LIB': 'Interface Libraries',
	'3M': 'Mathematical Library Functions',
	'3MAIL': 'User Mailbox Library Functions',
	'3MALLOC': 'Memory Allocation Library Functions',
	'3MP': 'Multiple Precision Library Functions',
	'3MPAPI': 'Common Multipath Management Library Functions',
	'3NSL': 'Networking Services Library Functions',
	'3NVPAIR': 'Name-value Pair Library Functions',
	'3OFMT': 'Formatted Output Functions',
	'3PAM': 'PAM Library Functions',
	'3PAPI': 'PAPI Library Functions',
	'3PERL': 'Perl Library Functions',
	'3PICL': 'PICL Library Functions',
	'3PICLTREE': 'PICL Plug-In Library Functions',
	'3POOL': 'Pool Configuration Manipulation Library Functions',
	'3PROC': 'Process Control Library Functions',
	'3PROJECT': 'Project Database Access Library Functions',
	'3RAC': 'Remote Asynchronous Calls Library Functions',
	'3RESOLV': 'Resolver Library Functions',
	'3RPC': 'RPC Library Functions',
	'3RSM': 'Remote Shared Memory Library Functions',
	'3RT': 'Realtime Library Functions',
	'3SASL': 'Simple Authentication Security Layer Library Functions',
	'3SCF': 'Service Configuration Facility Library Functions',
	'3SEC': 'File Access Control Library Functions',
	'3SECDB': 'Security Attributes Database Library Functions',
	'3SIP': 'Session Initiation Protocol Library Functions',
	'3SLP': 'Service Location Protocol Library Functions',
	'3SOCKET': 'Sockets Library Functions',
	'3STMF': 'SCSI Target Mode Framework Library Functions',
	'3SYSEVENT': 'System Event Library Functions',
	'3TECLA': 'Interactive Command-line Input Library Functions',
	'3TNF': 'TNF Library Functions',
	'3TSOL': 'Trusted Extensions Library Functions',
	'3UTEMPTER': 'UTEMPTER Library Functions',
	'3UUID': 'Universally Unique Identifier Library Functions',
	'3VOLMGT': 'Volume Management Library Functions',
	'3XCURSES': 'X/Open Curses Library Functions',
	'3XNET': 'X/Open Networking Services Library Functions',
	'3F': 'Fortran Library Routines',
	'3X': 'Miscellaneous Library Functions',
	'4': 'Device and Network Interfaces',
	'4D': 'Devices',
	'4FS': 'File Systems',
	'4I': 'Ioctl Requests',
	'4IPP': 'IP Quality of Service Modules',
	'4M': 'STREAMS Modules',
	'4P': 'Protocols',
	'5': 'File Formats and Configurations',
	'6': 'Games and Demos',
	'7': 'Standards, Environments, and Macros',
	'8': 'Maintenance Commands and Procedures',
	'9': 'Kernel Concepts',
	'9E': 'Driver Entry Points',
	'9F': 'Kernel Functions for Drivers',
	'9P': 'Kernel Properties for Drivers',
	'9S': 'Data Structures for Drivers',
};

function
translate_from_old_name(sect)
{
	var sect = sect.toUpperCase();
	var prefix = sect.substr(0, 1);
	var tail = sect.substr(1);

	switch (prefix) {
	case '1':
		/*
		 * Subsection 1M was moved out to a new top-level section:
		 */
		if (tail == 'M') {
			return ('8');
		}
		break;

	/*
	 * Sections 4, 5, and 7, were renamed as a whole:
	 */
	case '4':
		return ('5' + tail);
	case '5':
		return ('7' + tail);
	case '7':
		return ('4' + tail);
	}

	return (null);
}

function
lookup_section(s)
{
	if (!s) {
		return (null);
	}

	return (SECTIONS[s.toUpperCase()] || null);
}

function
lookup_subsection(s)
{
	if (!s) {
		return (null);
	}

	return (SUBSECTIONS[s.toUpperCase()] || null);
}

function
Mandir(dirs)
{
	this.md_dirs = [];

	this.md_sections = [];
	this.md_subsections = [];
	this.md_searchorder = [];
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

		/*
		 * If no section was provided we want to search sections in
		 * lexical order, with a few exceptions.
		 *
		 * We want administrative commands (section 8) to appear
		 * roughly where the old section 1M used to appear; i.e.,
		 * before system calls and library routines.  Section 8 must
		 * also appear before section 1B, which contains historic
		 * baggage that is almost certainly not relevant to users.
		 *
		 * In the library area, we want 3C and 3SOCKET to appear before
		 * other subsections.
		 *
		 * Construct that default search order now:
		 */
		self.md_searchorder = [];
		self.md_searchorder.push('1');
		self.md_searchorder.push('8');
		for (var i = 0; i < self.md_subsections.length; i++) {
			var ss = self.md_subsections[i];
			if (ss.substr(0, 1) !== '1') {
				continue;
			}
			if (ss === '1b') {
				continue;
			}
			if (self.md_searchorder.indexOf(ss) === -1) {
				self.md_searchorder.push(ss);
			}
		}
		self.md_searchorder.push('1b');
		for (var i = 0; i < self.md_subsections.length; i++) {
			var ss = self.md_subsections[i];
			if (ss.substr(0, 1) !== '2') {
				continue;
			}
			if (self.md_searchorder.indexOf(ss) === -1) {
				self.md_searchorder.push(ss);
			}
		}
		self.md_searchorder.push('3');
		self.md_searchorder.push('3c');
		self.md_searchorder.push('3socket');
		for (var i = 0; i < self.md_subsections.length; i++) {
			var ss = self.md_subsections[i];
			if (self.md_searchorder.indexOf(ss) === -1) {
				self.md_searchorder.push(ss);
			}
		}

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
			title: lookup_section(sect),
			subsections: []
		};

		for (var j = 0; j < self.md_subsections.length; j++) {
			var subsect = self.md_subsections[j];

			if (subsect.substr(0, 1) !== sect) {
				continue;
			}

			o.subsections.push({
				name: subsect,
				title: lookup_subsection(subsect),
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
				if (err.code === 'ENOENT') {
					/*
					 * Not every mandir will have pages
					 * for every section.
					 */
					next();
					return;
				}

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

		var sect_title = lookup_section(sect.substr(0, 1));
		var subsect_title = lookup_subsection(sect);
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

	/*
	 * Construct the section search order.  This is somewhat complicated
	 * because we want to provide a measure of backwards compatibilty for
	 * the old manual page section structure prior to IPD 4.
	 */
	var search = [];
	if (sect) {
		sect = sect.trim().toLowerCase();

		/*
		 * Always search the nominated section first.
		 */
		search.push(sect);

		var newsect = translate_from_old_name(sect);
		if (newsect !== null) {
			/*
			 * If the section was renamed, try the new name:
			 */
			search.push(newsect.toLowerCase());
		}
	} else {
		/*
		 * If no section was specified, use the default search order:
		 */
		search = self.md_searchorder;
	}

	/*
	 * Generate a search plan that walks through each configured manual
	 * path:
	 */
	var plan = [];
	for (var i = 0; i < self.md_dirs.length; i++) {
		for (var j = 0; j < search.length; j++) {
			plan.push({ dir: self.md_dirs[i], sect: search[j] });
		}
	}

	var keep_trying = function () {
		if (plan.length < 1) {
			var ee = new Error('Page not found.');
			ee.code = 'ENOENT';
			cb(ee);
			return;
		}

		var step = plan.shift();
		var file = mod_path.join(step.dir, 'man' + step.sect,
		    page + '.' + step.sect);

		mod_fs.stat(file, function (err, st) {
			if (err) {
				if (err.code === 'ENOENT') {
					setImmediate(keep_trying);
					return;
				}
				cb(err);
				return;
			}

			cb(null, file, step.sect.toUpperCase());
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

		console.log('%j', md);

		cb(null, md);
	});
}

module.exports = {
	create_mandir: create_mandir,
	translate_from_old_name: translate_from_old_name,
};

/* vim: set ts=8 sts=8 sw=8 noet: */
