# Change Log

## [1.1.2](https://github.com/david-04/7-sync/releases/tag/v1.1.1) (2023-08-18)

- Fixed a race condition that could delete directories before the contained files were deleted

## [1.1.1](https://github.com/david-04/7-sync/releases/tag/v1.1.1) (2023-01-07)

- Fixed an issue that prevented the last few files from being added to the database and the index file, causing orphan warnings in subsequent synchronisations

## [1.1.0](https://github.com/david-04/7-sync/releases/tag/v1.1.0) (2022-12-30)

- Increased throughput by zipping multiple files simultaneously (command line option `--parallel`, default: `2`)
- Fixed an issue that prevented root directory source files starting with `@` or `-` from being zipped

## [1.0.3](https://github.com/david-04/7-sync/releases/tag/v1.0.3) (2022-05-27)

- Technical maintenance (satisfy more SonarQube linting rules)

## [1.0.2](https://github.com/david-04/7-sync/releases/tag/v1.0.2) (2022-04-23)

- Avoid Windows reserved filenames (e.g. `PRN`, `AUX`, `NUL`, `COM1`, ...)

## [1.0.1](https://github.com/david-04/7-sync/releases/tag/v1.0.1) (2022-04-15)

- Fixed link to CHANGELOG


## [1.0.0](https://github.com/david-04/7-sync/releases/tag/v1.0.0) (2022-04-15)

- Added a README to the package

## [0.9.0](https://github.com/david-04/7-sync/releases/tag/v0.9.0) (2022-04-15)

- Initial release
