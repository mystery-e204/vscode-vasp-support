# Change Log

All notable changes to the "vasp-support" extension will be documented in this file.

## [Unreleased]

### Added

* KPOINTS support

## [0.2.3]

### Fixed

* POSCAR code lenses broken

## [0.2.2]

### Fixed

* POSCAR linter being inconsistent with VASP parsing

### Changed

* Improved POSCAR parsing and linting

## [0.2.1]

### Fixed

* Certain INCAR tags being parsed wrongly (e.g. LWAVE)

## [0.2.0]

### Added

* POSCAR/CONTCAR support
    * Semantic highlighting
    * Linting
    * Setting to toggle linting
    * Code lenses
    * Setting to toggle code lenses

## [0.1.3]

### Added

* Persistent storage for INCAR tags. Once parsed, the INCAR information is now stored offline. Dramatically speeds up the hover provider on subsequent starts.

## [0.1.2]

### Changed

* Improved INCAR syntax support

## [0.1.1]

### Added

* INCAR syntax support

## [0.1.0]

### Added

* INCAR hover support
* Short description in README.md
