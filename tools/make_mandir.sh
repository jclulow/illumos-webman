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

