autorun : dist/7-sync.js
	node $^ sync

dist/7-sync.js : $(wildcard src/* src/*/* src/*/*/* src/*/*/*/*)
	tsc
