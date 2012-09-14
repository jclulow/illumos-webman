#!/bin/ksh

DIR=$(dirname $(whence $0))/..

export PATH=/usr/sbin:/usr/bin:$PATH
export PROTO=$DIR/proto.man
export ROOT=$PROTO
export SRC=$HOME/illumos-gate/usr/src
export MAKE=$DIR/make
export MAKEFLAGS="-e"
export BUILD64="#"

mkdir -p $PROTO || exit 1

(cd $SRC && cp $DIR/make.rules . && $DIR/make rootdirs)
(cd $SRC/man && cp $DIR/make.rules . && $DIR/make install)

# fudge in the /opt/onbld/man manpages...
rm -rf $PROTO/usr/share/man/man1onbld
mkdir -p $PROTO/usr/share/man/man1onbld
(cd $SRC/tools && find . -name \*.1 -exec cp {} \
   $PROTO/usr/share/man/man1onbld \; )
(cd $PROTO/usr/share/man/man1onbld &&
  for f in *.1; do mv $f ${f}onbld; done)
