// ==================================================
// GLOBAL VARIABLES
// ==================================================

let allFiles = [];


// ==================================================
// DOM ELEMENTS
// ==================================================

const authPage =
    document.getElementById("authPage");

const dashboardPage =
    document.getElementById("dashboardPage");

const loginTab =
    document.getElementById("loginTab");

const signupTab =
    document.getElementById("signupTab");

const loginForm =
    document.getElementById("loginForm");

const signupForm =
    document.getElementById("signupForm");

const authMessage =
    document.getElementById("authMessage");


// ==================================================
// AUTH TABS
// ==================================================

loginTab.addEventListener(
    "click",
    () => {

        loginTab.classList.add("active");
        signupTab.classList.remove("active");

        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");

        clearAuthMessage();
    }
);


signupTab.addEventListener(
    "click",
    () => {

        signupTab.classList.add("active");
        loginTab.classList.remove("active");

        signupForm.classList.remove("hidden");
        loginForm.classList.add("hidden");

        clearAuthMessage();
    }
);


// ==================================================
// LOGIN
// ==================================================

loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const identifier =
            document.getElementById(
                "loginIdentifier"
            ).value;

        const password =
            document.getElementById(
                "loginPassword"
            ).value;


        try {

            const response =
                await fetch(
                    "/api/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            identifier,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!data.success) {

                showAuthMessage(
                    data.message,
                    true
                );

                return;
            }


            showAuthMessage(
                "Login successful.",
                false
            );


            setTimeout(
                showDashboard,
                300
            );


        } catch (error) {

            showAuthMessage(
                "Unable to connect to server.",
                true
            );

        }

    }
);


// ==================================================
// SIGNUP
// ==================================================

signupForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const username =
            document.getElementById(
                "signupUsername"
            ).value;

        const email =
            document.getElementById(
                "signupEmail"
            ).value;

        const password =
            document.getElementById(
                "signupPassword"
            ).value;


        try {

            const response =
                await fetch(
                    "/api/signup",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            email,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!data.success) {

                showAuthMessage(
                    data.message,
                    true
                );

                return;
            }


            showAuthMessage(
                "Account created successfully.",
                false
            );


            setTimeout(
                showDashboard,
                300
            );


        } catch (error) {

            showAuthMessage(
                "Unable to connect to server.",
                true
            );

        }

    }
);


// ==================================================
// CHECK LOGIN STATUS
// ==================================================

async function checkLogin() {

    try {

        const response =
            await fetch("/api/me");

        const data =
            await response.json();


        if (data.logged_in) {

            showDashboard();

        } else {

            showAuth();

        }

    } catch (error) {

        showAuth();

    }
}


// ==================================================
// SHOW AUTH
// ==================================================

function showAuth() {

    authPage.classList.remove("hidden");

    dashboardPage.classList.add("hidden");
}


// ==================================================
// SHOW DASHBOARD
// ==================================================

async function showDashboard() {

    authPage.classList.add("hidden");

    dashboardPage.classList.remove("hidden");

    await loadUser();

    await loadFiles();
}


// ==================================================
// LOAD USER
// ==================================================

async function loadUser() {

    const response =
        await fetch("/api/me");

    const data =
        await response.json();


    if (!data.logged_in) {

        showAuth();

        return;
    }


    document.getElementById(
        "usernameDisplay"
    ).textContent =
        data.username;


    document.getElementById(
        "emailDisplay"
    ).textContent =
        data.email;


    document.getElementById(
        "userAvatar"
    ).textContent =
        data.username
            .charAt(0)
            .toUpperCase();
}


// ==================================================
// LOAD FILES
// ==================================================

async function loadFiles() {

    try {

        const response =
            await fetch("/api/files");


        if (response.status === 401) {

            showAuth();

            return;
        }


        const data =
            await response.json();


        allFiles =
            data.files;


        updateStorage(
            data.used,
            data.quota
        );


        displayFiles(
            allFiles
        );


    } catch (error) {

        showToast(
            "Could not load files.",
            true
        );

    }
}


// ==================================================
// DISPLAY FILES
// ==================================================

function displayFiles(files) {

    const grid =
        document.getElementById(
            "fileGrid"
        );

    const empty =
        document.getElementById(
            "emptyState"
        );

    const count =
        document.getElementById(
            "fileCount"
        );


    grid.innerHTML = "";


    count.textContent =
        `${files.length} ${
            files.length === 1
                ? "file"
                : "files"
        }`;


    if (files.length === 0) {

        empty.classList.remove(
            "hidden"
        );

        return;

    }


    empty.classList.add(
        "hidden"
    );


    files.forEach(
        file => {

            grid.appendChild(
                createFileCard(file)
            );

        }
    );
}


// ==================================================
// CREATE FILE CARD
// ==================================================

function createFileCard(file) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "file-card";


    const icon =
        document.createElement(
            "div"
        );

    icon.className =
        "file-icon";

    icon.textContent =
        getFileIcon(
            file.name,
            file.type
        );


    const info =
        document.createElement(
            "div"
        );

    info.className =
        "file-info";


    const name =
        document.createElement(
            "div"
        );

    name.className =
        "file-name";

    name.textContent =
        file.name;

    name.title =
        file.name;


    const meta =
        document.createElement(
            "div"
        );

    meta.className =
        "file-meta";

    meta.textContent =
        `${file.size_text} • ${
            formatDate(
                file.uploaded_at
            )
        }`;


    info.appendChild(name);

    info.appendChild(meta);


    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "file-actions";


    const download =
        document.createElement(
            "a"
        );

    download.className =
        "download-button";

    download.textContent =
        "↓";

    download.href =
        `/api/download/${file.id}`;

    download.title =
        "Download";


    const deleteButton =
        document.createElement(
            "button"
        );

    deleteButton.className =
        "delete-button";

    deleteButton.textContent =
        "×";

    deleteButton.title =
        "Delete";


    deleteButton.addEventListener(
        "click",
        () => {

            deleteFile(
                file.id,
                file.name
            );

        }
    );


    actions.appendChild(
        download
    );

    actions.appendChild(
        deleteButton
    );


    card.appendChild(icon);

    card.appendChild(info);

    card.appendChild(actions);


    return card;
}


// ==================================================
// DELETE FILE
// ==================================================

async function deleteFile(
    fileId,
    filename
) {

    const confirmed =
        confirm(
            `Are you sure you want to permanently delete "${filename}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/files/${fileId}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            showToast(
                data.message,
                true
            );

            return;
        }


        showToast(
            "File deleted successfully."
        );


        await loadFiles();


    } catch (error) {

        showToast(
            "Delete failed.",
            true
        );

    }
}


// ==================================================
// UPLOAD BUTTON
// ==================================================

const uploadButton =
    document.getElementById(
        "uploadButton"
    );

const chooseFilesButton =
    document.getElementById(
        "chooseFilesButton"
    );

const fileInput =
    document.getElementById(
        "fileInput"
    );


uploadButton.addEventListener(
    "click",
    () => fileInput.click()
);


chooseFilesButton.addEventListener(
    "click",
    () => fileInput.click()
);


// ==================================================
// FILE SELECT
// ==================================================

fileInput.addEventListener(
    "change",
    () => {

        const files =
            Array.from(
                fileInput.files
            );


        if (files.length > 0) {

            uploadFiles(files);

        }


        fileInput.value = "";

    }
);


// ==================================================
// DRAG AND DROP
// ==================================================

const uploadArea =
    document.getElementById(
        "uploadArea"
    );


[
    "dragenter",
    "dragover"
].forEach(
    eventName => {

        uploadArea.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                uploadArea.classList.add(
                    "dragover"
                );

            }
        );

    }
);


[
    "dragleave",
    "drop"
].forEach(
    eventName => {

        uploadArea.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                uploadArea.classList.remove(
                    "dragover"
                );

            }
        );

    }
);


uploadArea.addEventListener(
    "drop",
    event => {

        const files =
            Array.from(
                event.dataTransfer.files
            );


        if (files.length > 0) {

            uploadFiles(files);

        }

    }
);


// ==================================================
// UPLOAD FILES
// ==================================================

async function uploadFiles(files) {

    for (
        let i = 0;
        i < files.length;
        i++
    ) {

        await uploadSingleFile(
            files[i],
            i + 1,
            files.length
        );

    }

    await loadFiles();
}


// ==================================================
// SINGLE FILE UPLOAD
// ==================================================

function uploadSingleFile(
    file,
    current,
    total
) {

    return new Promise(
        resolve => {

            const progressContainer =
                document.getElementById(
                    "uploadProgressContainer"
                );

            const progress =
                document.getElementById(
                    "uploadProgress"
                );

            const percent =
                document.getElementById(
                    "uploadPercent"
                );

            const status =
                document.getElementById(
                    "uploadStatus"
                );


            progressContainer.classList.remove(
                "hidden"
            );


            status.textContent =
                `Uploading ${current} of ${total}: ${file.name}`;


            progress.style.width =
                "0%";


            percent.textContent =
                "0%";


            const formData =
                new FormData();


            formData.append(
                "file",
                file
            );


            const xhr =
                new XMLHttpRequest();


            xhr.open(
                "POST",
                "/api/upload"
            );


            xhr.upload.addEventListener(
                "progress",
                event => {

                    if (!event.lengthComputable) {
                        return;
                    }


                    const value =
                        Math.round(
                            (
                                event.loaded /
                                event.total
                            ) * 100
                        );


                    progress.style.width =
                        `${value}%`;


                    percent.textContent =
                        `${value}%`;

                }
            );


            xhr.onload =
                function() {

                    let data;

                    try {

                        data =
                            JSON.parse(
                                xhr.responseText
                            );

                    } catch {

                        data = {
                            success: false,
                            message:
                                "Upload failed."
                        };

                    }


                    if (
                        xhr.status >= 200 &&
                        xhr.status < 300 &&
                        data.success
                    ) {

                        showToast(
                            `${file.name} uploaded successfully.`
                        );

                    } else {

                        showToast(
                            data.message ||
                            "Upload failed.",
                            true
                        );

                    }


                    if (current === total) {

                        setTimeout(
                            () => {

                                progressContainer
                                    .classList
                                    .add("hidden");

                            },
                            700
                        );

                    }


                    resolve();

                };


            xhr.onerror =
                function() {

                    showToast(
                        "Network error during upload.",
                        true
                    );

                    resolve();

                };


            xhr.send(
                formData
            );

        }
    );
}


// ==================================================
// SEARCH
// ==================================================

const searchInput =
    document.getElementById(
        "searchInput"
    );


searchInput.addEventListener(
    "input",
    () => {

        const query =
            searchInput.value
                .trim()
                .toLowerCase();


        const filtered =
            allFiles.filter(
                file =>
                    file.name
                        .toLowerCase()
                        .includes(query)
            );


        displayFiles(
            filtered
        );

    }
);


// ==================================================
// REFRESH
// ==================================================

document.getElementById(
    "refreshButton"
).addEventListener(
    "click",
    loadFiles
);


// ==================================================
// NAV UPLOAD
// ==================================================

document.getElementById(
    "navUpload"
).addEventListener(
    "click",
    () => {

        uploadArea.scrollIntoView({
            behavior: "smooth"
        });

    }
);


// ==================================================
// LOGOUT
// ==================================================

document.getElementById(
    "logoutButton"
).addEventListener(
    "click",
    async () => {

        await fetch(
            "/api/logout",
            {
                method: "POST"
            }
        );


        allFiles = [];

        showAuth();

        showToast(
            "Logged out successfully."
        );

    }
);


// ==================================================
// STORAGE
// ==================================================

function updateStorage(
    used,
    quota
) {

    const percentage =
        Math.min(
            (used / quota) * 100,
            100
        );


    document.getElementById(
        "storageBar"
    ).style.width =
        `${percentage}%`;


    document.getElementById(
        "storageText"
    ).textContent =
        `${formatBytes(used)} / ${
            formatBytes(quota)
        }`;
}


// ==================================================
// FILE ICON
// ==================================================

function getFileIcon(
    filename,
    type
) {

    const lower =
        filename.toLowerCase();


    if (
        type &&
        type.startsWith("image/")
    ) {
        return "🖼️";
    }


    if (
        type &&
        type.startsWith("video/")
    ) {
        return "🎬";
    }


    if (
        type &&
        type.startsWith("audio/")
    ) {
        return "🎵";
    }


    if (
        lower.endsWith(".pdf")
    ) {
        return "📕";
    }


    if (
        lower.endsWith(".doc") ||
        lower.endsWith(".docx")
    ) {
        return "📘";
    }


    if (
        lower.endsWith(".xls") ||
        lower.endsWith(".xlsx") ||
        lower.endsWith(".csv")
    ) {
        return "📗";
    }


    if (
        lower.endsWith(".zip") ||
        lower.endsWith(".rar")
    ) {
        return "🗜️";
    }


    if (
        lower.endsWith(".txt") ||
        lower.endsWith(".md")
    ) {
        return "📄";
    }


    return "📦";
}


// ==================================================
// FORMAT SIZE
// ==================================================

function formatBytes(bytes) {

    if (bytes < 1024) {
        return `${bytes} B`;
    }


    if (bytes < 1024 * 1024) {

        return `${
            (bytes / 1024)
                .toFixed(1)
        } KB`;

    }


    if (bytes < 1024 * 1024 * 1024) {

        return `${
            (bytes / (1024 * 1024))
                .toFixed(1)
        } MB`;

    }


    return `${
        (
            bytes /
            (1024 * 1024 * 1024)
        ).toFixed(1)
    } GB`;
}


// ==================================================
// FORMAT DATE
// ==================================================

function formatDate(value) {

    const date =
        new Date(value);


    return date.toLocaleString(
        [],
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}


// ==================================================
// AUTH MESSAGE
// ==================================================

function showAuthMessage(
    message,
    error
) {

    authMessage.textContent =
        message;


    authMessage.className =
        "message " +
        (
            error
                ? "error"
                : "success"
        );

}


function clearAuthMessage() {

    authMessage.textContent = "";

    authMessage.className =
        "message";

}


// ==================================================
// TOAST
// ==================================================

function showToast(
    message,
    error = false
) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.remove(
        "hidden"
    );


    toast.style.background =
        error
            ? "#991b1b"
            : "#172033";


    clearTimeout(
        window.toastTimer
    );


    window.toastTimer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

            },
            3000
        );
}


// ==================================================
// START APPLICATION
// ==================================================

checkLogin();