# VASP Support

Provides support for files of [VASP](https://www.vasp.at/). Currently, only [INCAR](https://www.vasp.at/wiki/index.php/INCAR) and [POSCAR](https://www.vasp.at/wiki/index.php/POSCAR)/[CONTCAR](https://www.vasp.at/wiki/index.php/CONTCAR) files are supported.

## Features

* INCAR
    * Syntax highlighting
    * Hover provider with live information from the [VASP Wiki](https://www.vasp.at/wiki/index.php/The_VASP_Manual)
        ![INCAR hover](assets/incar-hover.gif)
* POSCAR/CONTCAR
    * Semantic highlighting
        ![POSCAR semantic tokens](assets/poscar-still.png)
    * Linting (can be toggled in settings)
        ![POSCAR errors](assets/poscar-linting.gif)
    * Code lenses to describe the different POSCAR sections (can be toggled in settings)
        ![POSCAR code lenses](assets/poscar-code-lens.gif)