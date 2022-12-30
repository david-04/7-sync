7_SYNC_JS=dist/7-sync.js
RUN=node "../$(7_SYNC_JS)"
VERSION=$(shell grep -E "^## \[[0-9.]+\]" CHANGELOG.md | head -1 | sed "s|^\#\# \[||;s|\].*||")

autorun : ;
	$(info )
	$(info $()  build ..... compile the application)
	$(info $()  help ...... 7-sync --help)
	$(info $()  publish ... publish the release to NPM)
	$(info $()  release ... assemble the release)
	$(info $()  version ... 7-sync --version)

autorun.editor : build;

#-----------------------------------------------------------------------------------------------------------------------
# Compile
#-----------------------------------------------------------------------------------------------------------------------

build : $(7_SYNC_JS);

$(7_SYNC_JS) : $(wildcard src/*.ts src/*/*.ts src/*/*/*.ts src/*/*/*/*.ts)
	echo Compiling....
	tsc

#-----------------------------------------------------------------------------------------------------------------------
# Test
#-----------------------------------------------------------------------------------------------------------------------

init : $(7_SYNC_JS)
	cd test && rm -f 7-sync.cfg; $(RUN) init # --config=7-sync.cfg

reconfigure : $(7_SYNC_JS)
	cd test && $(RUN) reconfigure # --config=7-sync.cfg

sync : $(7_SYNC_JS)
	rm -f test/*.log
	cd test && $(RUN) sync --password=a

help : $(7_SYNC_JS)
	cd test && $(RUN) --help

version : $(7_SYNC_JS)
	cd test && $(RUN) --version


#-----------------------------------------------------------------------------------------------------------------------
# Release
#-----------------------------------------------------------------------------------------------------------------------

release : clean update-version build
	cp -f $(7_SYNC_JS) package

update-version :
	cat package/package.json \
		| sed -E 's|"version": "[0-9.]+"|"version": "$(VERSION)"|' \
		> package/package.json.tmp
	mv -f package/package.json.tmp package/package.json
	sed 's|.*APPLICATION_VERSION.*|const APPLICATION_VERSION = "$(VERSION)"|' src/version.ts \
		> src/version.ts.tmp
	mv -f src/version.ts.tmp src/version.ts

#-----------------------------------------------------------------------------------------------------------------------
# Publish
#-----------------------------------------------------------------------------------------------------------------------

publish :
	cd package && npm publish

#-----------------------------------------------------------------------------------------------------------------------
# Clean
#-----------------------------------------------------------------------------------------------------------------------

clean :
    ifneq "$(wildcard dist/7-sync.js test/*.log test/*.out test/compare test/destination test/source)" ""
	rm -rf dist/7-sync.js test/*.log test/*.out test/compare test/destination test/source
    endif
