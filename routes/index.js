
/*
 * GET home page.
 */

var spawn = require('child_process').execFile;
var fs = require('fs');
var path = require('path');

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
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

/*
function formatLine(line)
{
  var len = line.length;
  var pos = 0;
  var lic = 0;
  var state = 'REST';
  while (pos < len) {
    var c = line.charAt(pos);
    switch (state) {
      case 'REST':
        if (c < 'a' && c > 'z')
    }
  }
}*/

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
          y += '<b>' + sanitise(l) + '</b><br>\n';
        } else {
          y += maybeFormat(sanitise(l)) + '<br>\n';
        }
      }
    }

    res.render('manpage', {
      title: 'illumos: manual page: ' + page +
                 (section ? '(' + section + ')' : ''),
      pagetext: y
    });
  });
};

var MANPATH = path.join(process.env.HOME, 'proj', 'webman',
                        'proto.man', 'usr', 'share', 'man');

var SECTIONS = {
  'man1': 'User Commands',
  'man1b': 'SunOS/BSD Compatibility Package Commands',
  'man1c': 'Communication Commands',
  'man1m': 'Maintenance Commands',
  'man2': 'System Calls',
  'man3c': 'Standard C Library Functions',
  'man4': 'File Formats',
  'man5': 'Standards, Environments, and Macros',
  'man7d': 'Devices',
  'man9f': 'Kernel Functions for Drivers',
};

exports.sectionlist = function(req, res) {
  fs.readdir(MANPATH, function(err, dirs) {
    if (err) {
      return res.send(500, 'sorry!');
    }

    dirs = dirs.sort();

    var y = '<h1>illumos: manual sections</h1><table>';
    for (var i = 0; i < dirs.length; i++) {
      var section = SECTIONS[dirs[i]] || '';
      var shortn = dirs[i].replace(/^man/, '');
      y += '<tr><td><a href="/man/' + shortn +
        '/all">' + dirs[i] + '</a></td><td>' + section +
        '</td></tr>';
    }
    y += '</table>';

    return res.render('manpage', {
      title: 'illumos: manual sections',
      pagetext: y
    });
  });
};

exports.pagelist = function(req, res) {

   var section = null;
   if (req.params.section) {
     var t = req.params.section.replace(/[^a-zA-Z0-9]/g, '');
     if (t)
       section = t;
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
    var sname = SECTIONS['man' + section] || null;
    if (sname)
      y += '<h2>' + sname + '</h2>';
    y += '<table>';
    for (var i = 0; i < dirs.length; i++) {
      var shortn = dirs[i].replace(/\.[^.]*/, '');
      y += '<tr><td><a href="/man/' + section + '/' + shortn +
        '">' + shortn + '</a></td></tr>';
    }
    y += '</table>';

    return res.render('manpage', {
      title: 'illumos: manual section ' + section + ' index',
      pagetext: y
    });
  });
};


