//----------------------------------------------------------------------------------------------------------------------
// Links to the GitHub README
//----------------------------------------------------------------------------------------------------------------------

const README_URL_BASE = "https://github.com/david-04/7-sync/blob/main/README.md";
const README_URL_WARNINGS = `${README_URL_BASE}#user-content-errors`;
const README_URL_RESTORE = `${README_URL_BASE}#user-content-restoring-backups`;

//----------------------------------------------------------------------------------------------------------------------
// The README file that's added to the index
//----------------------------------------------------------------------------------------------------------------------

const README_FILE_CONTENT = `

    -------------------------------------------------------------------------------
    7-sync restore/recovery instructions
    -------------------------------------------------------------------------------

    This is an extract from the 7-sync manual. It can be found here:

    https://github.com/david-04/7-sync/blob/main/README.md#user-content-restoring-backups

    The following instructions explain how to restore some or all files from this
    backup.

    1. If the backup is stored in the cloud, download it first.

    - To restore the whole backup, download all files and directories.
    - To only restore selected files, open 7-sync-file-index.txt (stored in the
        same archive: ___INDEX___2022-04-10-07-25-47-394.7z). Look up the
        respective files and directories and download them from the cloud storage
        as required.

    2. Place all files that need to be unzipped/restored in one folder.

    3. Open 7-Zip and navigate to the folder containing the encrypted files.

    4. In the "View" menu, enable the "Flat View" option. This will show all files
    from all subdirectories in one list.

    5. Select all the files (but no directories).

    - Click on the first file in the list.
    - Scroll down to the bottom of the list.
    - While pressing the "Shift" key, click on the last file in the list.

    6. Click on the "Extract" button in the toolbar and configure how and where to
    extract the files:

    - Set the "Extract to" field to the directory where to place the decrypted
        files. The path must NOT contain "*" (like for example C:\Restore\*\).
        Also untick the checkbox right under this field. Otherwise, 7-Zip creates
        a separate subdirectory for each file being unzipped.
    - Set the "Path mode" to "Full pathnames".
    - Tick "Eliminate duplication of root folder".
    - Enter the password.

    7. Click on "OK". If the password is correct, 7-Zip will unpack all files.

`.trim().replace(/\n {4}/g, "\n").replace(/\r/g, "").trim() + "\n";
