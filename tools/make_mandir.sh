#!/bin/ksh
#
# This script is a concise embodiment of HERESY BY THOUGHT
# topped off immediately by HERESY BY DEED.  There may
# be additional HERESY, but in short:
#
#  tools/make is a hacked up copy of Sun make that looks
#   for make.rules in the current directory instead of
#   in /usr/share/lib/make.
#
#  ~/illumos-gate should have the gate checked out, but
#   otherwise untouched.
#
#  this script will hopefully, in a regular SmartMachine,
#   then totally just build the manpages into proto.man.
#
# Seriously, though, probably don't run this.
#

DIR=$(dirname $(whence $0))

export PATH=/usr/sbin:/usr/bin:$PATH
export PROTO=$DIR/../proto.man
export ROOT=$PROTO
export SRC=$HOME/illumos-gate/usr/src
export MAKE=$DIR/make
export MAKEFLAGS="-e"
export BUILD64="#"

mkdir -p $PROTO || exit 1

for dir in $SRC/man/*; do
  [[ -d $dir ]] && cp $DIR/make.rules $dir/make.rules
done

(cd $SRC && cp $DIR/make.rules . && $DIR/make rootdirs)
(cd $SRC/man && cp $DIR/make.rules . && $DIR/make install)

# fudge in the /opt/onbld/man manpages...
rm -rf $PROTO/usr/share/man/man1onbld
mkdir -p $PROTO/usr/share/man/man1onbld
(cd $SRC/tools && find . -name \*.1 -exec cp {} \
   $PROTO/usr/share/man/man1onbld \; )
(cd $PROTO/usr/share/man/man1onbld &&
  for f in *.1; do mv $f ${f}onbld; done)
