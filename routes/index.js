/*
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the copyright
 * notice below and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Copyright (c) 2012 Joshua M. Clulow <josh@sysmgr.org>
 */

/*
 * Well, *this* escalated quickly.
 */

var spawn = require('child_process').execFile;
var fs = require('fs');
var path = require('path');

var CONFIG;
try {
  CONFIG = require('../config.json');
} catch (ex) {
  CONFIG = {};
}

function
make_options(title, pagetext)
{
  var o = {};
  if (CONFIG.google_analytics_key)
    o.google_analytics_key = CONFIG.google_analytics_key;
  o.title = title;
  if (pagetext)
    o.pagetext = pagetext;
  return (o);
}

exports.index = function(req, res){
  res.render('index', make_options('Express'));
};

function sanitise(y)
{
  y = y.replace(/\&/g, '&amp;');
  y = y.replace(/\t/g, '        ');
  y = y.replace(/ /g, '&nbsp;');
  y = y.replace(/</g, '&lt;');
  y = y.replace(/>/g, '&gt;');
  return (y);
}

function isHeadingLine(line)
{
  var c = line.charAt(0);
  if (c < 'A' || c > 'Z') {
    return (false);
  }
  for (var i = 1; i < line.length; i++) {
    c = line.charAt(i);
    if ((c < 'A' || c > 'Z') && c != ' ') {
      return (false);
    }
  }
  return (true);
}

function maybeFormat(line)
{
  line = line.replace(/(Example&nbsp;[0-9]+)/g, '<b>$1</b>');
  if (!line.match(/^SunOS&nbsp;5/)) {
    line = line.replace(/([a-zA-Z0-9:._\-]+)\(([0-9][a-zA-Z0-9]*)\)/g,
        '<a href="/man/$2/$1">$1($2)</a>');
  }
  return (line);
}

exports.manpage = function(req, res) {
  /* figure out what page we're after */
  var section = null;
  var page = null;
  if (req.params.section) {
    var t = req.params.section.replace(/[^a-zA-Z0-9]/g, '');
    if (t)
      section = t;
  }
  if (req.params.page) {
    var t = req.params.page.replace(/[^a-zA-Z0-9\-_.:]/g, '');
    t = t.replace(/\.\./g, '');
    if (t)
      page = t;
  }

  if (page === null) {
    res.send(404, 'Sorry, invalid request for page.  Please try again.');
    return;
  }

  /* hack to support /man/1/ URLs... */
  if (!section && page.match(/^[0-9]/)) {
    req.params.section = page;
    return exports.pagelist(req, res);
  }

  var manargs = [];
  if (section) {
    manargs.push('-s');
    manargs.push(section);
  }
  manargs.push(page);

  var man = spawn('/usr/bin/man', manargs);
  var col = spawn('/usr/bin/col', ['-x', '-b']);

  man.stdout.pipe(col.stdin);
  man.stderr.pipe(col.stdin);

  var x = '';
  col.stdout.on('data', function(data) {
    x += data.toString('utf8');
  });

  col.stdout.on('end', function() {

    var notFound = false;
    if (x.match(/^No entry for/))
      notFound = true;

    var lines = x.split('\n');
    var y = '';
    var empty = 0;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) {
        empty++;
        if (empty < 3)
          y += '<br>';
      } else {
        empty = 0;
        if (isHeadingLine(l)) {
          var aName = sanitise(l.replace(/ /g, '_')).trim().toLowerCase();
          y += '<b><a name="' + aName + '"></a>' + sanitise(l) + '</b><br>\n';
        } else {
          y += maybeFormat(sanitise(l)) + '<br>\n';
        }
      }
    }

    var title;
    if (notFound) {
      res.status(404);
      title = 'illumos: manual page not found: ' + page +
        (section ? '(' + section + ')' : '');
    } else {
      res.status(200);
      title = 'illumos: manual page: ' + page +
        (section ? '(' + section + ')' : '');
    }
    res.render('manpage', make_options(title, y));
  });
};

var MANPATH = path.join(process.env.HOME, 'proj', 'webman',
                        'proto.man', 'usr', 'share', 'man');

var SECTIONS = {
  1: 'Commands',
  2: 'System Calls',
  3: 'Libraries',
  4: 'File Formats',
  5: 'Standards, Environments, and Macros',
  6: 'There Is Nooooooooo... Section 6',
  7: 'Device and Network Interfaces',
  8: 'This Section Intentionally Left Blank',
  9: 'Driver Entry Points'
};
var SUBSECTIONS = {
  'man1': 'User Commands',
  'man1b': 'SunOS/BSD Compatibility Package Commands',
  'man1c': 'Communication Commands',
  'man1m': 'Maintenance Commands',
  'man2': 'System Calls',
  'man3': 'Introduction to Library Functions',
  'man3bsm': 'Security and Auditing Library Functions',
  'man3c': 'Standard C Library Functions',
  'man3cfgadm': 'Configuration Administration Library Functions',
  'man3contract': 'Contract Subsystem Interfaces',
  'man3curses': 'Curses Library Functions',
  'man3xnet': 'X/Open Networking Interfaces',
  'man3libucb': 'SunOS/BSD Compatibility Libraries',
  'man4': 'File Formats',
  'man5': 'Standards, Environments, and Macros',
  'man7': 'Device and Network Interfaces',
  'man7d': 'Devices',
  'man7fs': 'File Systems',
  'man7i': 'ioctl Requests',
  'man7ipp': 'Miscellaneous References',
  'man7m': 'STREAMS Modules',
  'man7p': 'Protocols',
  'man9e': 'Driver Entry Points',
  'man9f': 'Kernel Functions',
  'man9p': 'Driver Properties',
  'man9s': 'Data Structures',
};

exports.sectionlist = function(req, res) {
  fs.readdir(MANPATH, function(err, dirs) {
    if (err) {
      return res.send(500, 'sorry!');
    }

    dirs = dirs.sort();

    var lastnum = 0;
    var y = '<h1>illumos: manual sections</h1>';
    y += '<table>';
    for (var i = 0; i < dirs.length; i++) {
      var section = SUBSECTIONS[dirs[i]] || '';
      var shortn = dirs[i].replace(/^man/, '');
      var num = Number(shortn.replace(/^([0-9]+).*/, '$1'));
      if (num !== lastnum) {
        y += '<tr><td colspan="2"><h2>section ' + num +
          ': ' + SECTIONS[num] + '</h2>' +
          '</td></tr>';
        y += '<tr><td><a href="/man/' + num + '/intro">' +
          'intro.' + num + '</a></td><td>Section Introduction</td>' +
          '</tr>';
        y += '<tr><td colspan="2">&nbsp;</td></tr>';
        lastnum = num;
      }
      y += '<tr><td><a href="/man/' + shortn +
        '/all">' + dirs[i] + '</a></td><td>' + section +
        '</td></tr>';
    }
    y += '</table>';

    return res.render('manpage', make_options('illumos: manual sections', y));
  });
};

exports.pagelist = function(req, res) {

   var section = null;
   if (req.params.section) {
     var t = req.params.section.replace(/[^a-zA-Z0-9]/g, '');
     if (t)
       section = t.toLowerCase();
   }

   if (!section)
     return res.send(500, 'sorry, could not find section ' + section);

  var mp = path.join(MANPATH, 'man' + section);
  fs.readdir(mp, function(err, dirs) {
    if (err) {
      return res.send(500, 'sorry!');
    }

    dirs = dirs.sort();

    var y = '<h1>illumos: manual section ' + section + ' index</h1>';
    var sname = SUBSECTIONS['man' + section] || null;
    if (sname) {
      var num = Number(section.replace(/^([0-9]+).*/, '$1'));
      y += '<h2>' + SECTIONS[num] + ': ' + sname + '</h2>';
    }
    y += '<table>';
    if (dirs.indexOf('intro.' + section) !== -1) {
      y += '<tr><td><a href="/man/' + section + '/intro' +
        '">intro</a> (Section Introduction)</td></tr>';
      y += '<tr><td colspan="2">&nbsp;</td></tr>';
    } else if (dirs.indexOf('Intro.' + section) !== -1) {
      y += '<tr><td><a href="/man/' + section + '/Intro' +
        '">Intro</a> (Section Introduction)</td></tr>';
      y += '<tr><td colspan="2">&nbsp;</td></tr>';
    }
    for (var i = 0; i < dirs.length; i++) {
      if (dirs[i].match(/^[iI]ntro\./))
        continue;
      var shortn = dirs[i].replace(/\.[^.]+$/, '');
      y += '<tr><td><a href="/man/' + section + '/' + shortn +
        '">' + shortn + '</a></td></tr>';
    }
    y += '</table>';

    return res.render('manpage', make_options('illumos: manual section ' +
      section + ' index', y));
  });
};
