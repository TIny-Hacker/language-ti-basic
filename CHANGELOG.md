# Change Log

All notable changes to the "ti-basic" extension will be documented in this file.

## [1.0.0] - 2024-04-09

### Added
- Import TI-BASIC programs through command palette.
- Export TI-BASIC programs through command palette.

### Changed
- Re-introduce highlighting for certain unicode characters.

## [0.2.8] - 2024-01-25

### Fixed

- Properly detect syntax highlighting for all tokens, thanks to a file provided by [nineteendo](https://github.com/nineteendo).

## [0.2.7] - 2024-01-23

### Changed

- Organize commands by ones ending with ` ` and `(`.
- Restructure syntaxes to properly highlight more stuff.

## [0.2.6] - 2024-01-06

### Added

- Add support for matricies [A] through [J].

### Changed

- Less strict error checking for tokens to correctly highlight more often, mentioned in [#3](https://github.com/TIny-Hacker/language-ti-basic/issues/3).
- Check for ` ` and `(` to ensure correct syntax for certain tokens.
- Change logical operation scope to `keyword.operator.expression`, suggested by [nineteendo](https://github.com/nineteendo).
- Handle snippet arguments slightly differently to consistently highlight them.

## [0.2.1] - 2023-12-11

### Fixed

- Fix matching for DelVar and logical operations with code suggested by [nineteendo](https://github.com/nineteendo).

## [0.2.0] - 2023-03-08

### Added

- Language snippets provided by [Hamburger317](https://github.com/Hamburger317).

## [0.1.5] - 2023-02-21

### Changed

- Improved error checking in highlighting.
- Removed bracket highlighting so that there aren't a bunch of errors in optimized code.

### Fixed

- Fixed an issue with highlighting strings.

## [0.1.1] - 2023-02-20

### Changed

- Improved the README.

## [0.1.0] - 2023-02-20

### Added

- Highlighting for most tokens and other things.

## [0.0.1] - 2023-02-19

### Added

- Highlighting for control and operators.
- Language icon.
