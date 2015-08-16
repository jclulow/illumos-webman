#!/usr/bin/env node
/*
 * Copyright 2015 Joshua M. Clulow <josh@sysmgr.org>
 */

var mod_child = require('child_process');
var mod_path = require('path');

var mod_bunyan = require('bunyan');
var mod_restify = require('restify');

var lib_mandir = require('./lib/mandir');
var lib_fmt = require('./lib/fmt');
var lib_manstream = require('./lib/manstream');

var MANDIR;
var CONFIG = require('./etc/config.json');

var LOG = mod_bunyan.createLogger({
	name: 'illumos-webman',
	level: process.env.LOG_LEVEL || 'info'
});

lib_mandir.create_mandir(CONFIG.manpath, function (err, md) {
	if (err) {
		console.error(err.stack);
		process.exit(1);
	}

	MANDIR = md;
});

var SERVER = mod_restify.createServer({
	log: LOG.child({
		component: 'restify'
	}),
	name: 'illumos-webman'
});

SERVER.on('uncaughtException', function (err) {
	LOG.error(err, 'uncaught exception');
	throw (err);
});

function
send_page(res, title, show_title, rows)
{
	var out = [
		'<html>',
		'	<head>',
		'		<title>illumos: ' + title + '</title>',
		'		<style>',
		'			body {',
		'				padding: 25px;',
		'				font-size: 14px;',
		'				font-family: monospace;',
		'			}',
		'			h2, h3, h4 {',
		'				font-size: 14px;',
		'				font-family: monospace;',
		'			}',
		'			.manpage {',
		'				white-space: pre;',
		'			}',
		'			a#link {',
		'				color: #6600FF;',
		'			}',
		'		</style>',
		'	</head>',
		'	<body>'
	];

	if (show_title) {
		out.push('		<h1>illumos: ' + title + '</h1>');
	}

	out = out.concat(rows);

	out = out.concat([
		'	</body>',
		'</html>'
	]);

	var data = out.join('\n');
	res.writeHead(200, {
		'Content-Type': 'text/html',
		'Content-Length': Buffer.byteLength(data)
	});
	res.end(data);
}

function
render_index(req, res, next)
{
	var idx = MANDIR.index();

	var rows = [
		'<table>'
	];
	for (var i = 0; i < idx.length; i++) {
		var sect = idx[i];
		var out2 = [
			'<tr>',
			'	<td colspan="2"><h2>',
			'		section ' + sect.name + ': ' +
			    (sect.title || ''),
			'	</h2></td>',
			'</tr>',
			'<tr>',
			'	<td><a href="/man/' + sect.name + '/intro">',
			'		intro.' + sect.name,
			'	</a></td>',
			'	<td>Section Introduction</td>',
			'</tr>',
			'<tr>',
			'	<td colspan="2">&nbsp;</td>',
			'</tr>'
		];

		for (var j = 0; j < sect.subsections.length; j++) {
			var subs = sect.subsections[j];

			out2 = out2.concat([
				'<tr>',
				'	<td><a href="/man/' + subs.name +
				    '/all">',
				'		man' + subs.name,
				'	</a></td>',
				'	<td>',
				'		' + (subs.title || ''),
				'	</td>',
				'</tr>'
			]);
		}

		out2 = out2.concat([
			'<tr>',
			'	<td colspan="2">&nbsp;</td>',
			'</tr>'
		]);

		rows = rows.concat(out2);
	}
	rows.push('</table>');

	send_page(res, 'manual sections', true, rows);
	next();
}

function
render_section(sect, req, res, next)
{
	MANDIR.pages(sect, function (err, pages, title) {
		if (err) {
			if (err.code === 'ENOENT') {
				next(new mod_restify.errors.NotFoundError(
				    'The manual section "' + sect + '" was ' +
				    'not found.'));
				return;
			}
			next(err);
			return;
		}

		var rows = [];
		if (title) {
			rows.push('<h2>' + title + '</h2>');
		}
		rows.push('<table>');

		var idx;
		if ((idx = pages.indexOf('intro')) !== -1) {
			rows.push('<tr><td>');
			rows.push('<a href="/man/' + sect +
			    '/intro">intro</a> (Section Introduction)');
			rows.push('</td></tr>');
			rows.push('<tr><td colspan="2">&nbsp;</td></tr>');
			pages.splice(idx, 1);

			if ((idx = pages.indexOf('Intro')) !== -1) {
				pages.splice(idx, 1);
			}
		}

		for (var i = 0; i < pages.length; i++) {
			var page = pages[i];

			rows.push('<tr><td>');
			rows.push('<a href="/man/' + sect +
			    '/' + page + '">' + page + '</a>');
			rows.push('</td></tr>');
		}

		rows.push('</table>');

		send_page(res, 'manual section ' + sect + ' index', true, rows);
		next();
	});
}

function
render_page(sect, page, req, res, next)
{
	MANDIR.lookup(sect, page, function (err, path) {
		if (err) {
			if (err.code === 'ENOENT') {
				next(new mod_restify.errors.NotFoundError(
				    'The manual page "' + page + '" was ' +
				    'not found.'));
				return;
			}
			next(err);
			return;
		}

		var args = [
			'-Tascii',
			'-Owidth=80',
			path
		];

		var done = false;
		var cp = mod_child.spawn(CONFIG.mandoc, args);
		cp.on('error', function (err) {
			if (done)
				return;
			done = true;
			next(err);
		});
		cp.stdin.end();
		var data = '';
		var outs = cp.stdout.pipe(new lib_fmt.TeletypeStream()).
		    pipe(new lib_manstream.ManStream());
		outs.on('readable', function () {
			var ch;
			while ((ch = outs.read()) !== null) {
				data += ch;
			}
		});
		cp.on('close', function () {
			if (done)
				return;
			done = true;

			var shortn = mod_path.basename(path);
			send_page(res, 'manual page: ' + shortn, false, [
				'<div class="manpage">',
				data,
				'</div>'
			]);
			next();
		});
	});
}

function
handle_get(req, res, next)
{
	var sect = req.params[0];
	var page = req.params[1];

	/*
	 * Clean up the "section" and "page" parameters, if they were passed:
	 */
	if (sect) {
		sect = sect.trim();
	}
	if (page) {
		page = page.trim();
	}

	if (!sect || (sect === 'all' && !page)) {
		/*
		 * If no arguments were passed, or the section 'all' was passed,
		 * render the index page:
		 */
		render_index(req, res, next);
		return;
	}

	if (MANDIR.is_section(sect)) {
		if (!page || page === 'all') {
			render_section(sect, req, res, next);
			return;
		}

		render_page(sect, page, req, res, next);
		return;
	}

	if (page) {
		/*
		 * We're trying to look a page up in something that is not
		 * a section; bail out.
		 */
		next(new mod_restify.errors.NotFoundError(
		    'The manual section "' + sect + '" was ' +
		    'not found.'));
		return;
	}

	/*
	 * Last ditch effort: try and look up a page without specifying
	 * a section:
	 */
	render_page(null, sect, req, res, next);
}

/*
 * We use regular expressions here, as we must continue to support URLs with
 * an optional trailing slash:
 */
SERVER.get(/^\/man\/?$/, handle_get);
SERVER.get(/^\/man\/([^/]+)\/?$/, handle_get);
SERVER.get(/^\/man\/([^/]+)\/([^/]+)\/?$/, handle_get);

SERVER.on('after', mod_restify.auditLogger({
	log: LOG.child({
		component: 'audit'
	})
}));

SERVER.listen(CONFIG.listen.port, CONFIG.listen.ip, function (err) {
	if (err) {
		console.error(err.stack);
		process.exit(1);
	}

	LOG.info('listening on %s:%d', CONFIG.listen.ip, CONFIG.listen.port);
});

/* vim: set ts=8 sts=8 sw=8 noet: */
