7_SYNC_JS=dist/7-sync.js
RUN=node "../$(7_SYNC_JS)"

autorun : sync

init : $(7_SYNC_JS)
	cd test && rm -f 7-sync.cfg; $(RUN) init # --config=7-sync.cfg

reconfigure : $(7_SYNC_JS)
	cd test && $(RUN) reconfigure # --config=7-sync.cfg

sync : $(7_SYNC_JS)
    ifneq "$(wildcard test/*.log)" ""
	rm test/*.log
    endif
	mkdir -p test/out/subfolder
	mkdir -p test/out/subfolder/sub-sub-folder
	touch test/out/subfolder/file.txt
	touch test/out/subfolder/file2.txt
	touch test/out/subfolder/file3.txt
	touch test/out/subfolder/sub-sub-folder
	touch test/out/my-file.txt
	cp -f test/test-a.7z test/out
	rm -rf test/out/*
	mkdir -p test/out/subfolder1/subfolder2
	touch test/out/subfolder1/subfolder2/orphan1.txt
	touch test/out/subfolder1/subfolder2/orphan2.txt
	cd test && $(RUN) sync --password=a --7-zip=7z # --verbose

help : $(7_SYNC_JS)
	cd test && $(RUN) --help

$(7_SYNC_JS) : $(wildcard src/* src/*/* src/*/*/* src/*/*/*/*)
	echo Compiling....
	tsc
