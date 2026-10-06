const state = {
    tender: null,
    requirements: [],
    files: [],
    matches: {},
    expiryDates: {},
    language: "en"
};


const requirementsInput =
    document.getElementById("requirementsFile");

const pdfInput =
    document.getElementById("pdfFiles");

const fileList =
    document.getElementById("fileList");

const requirementsList =
    document.getElementById("requirementsList");

const statusList =
    document.getElementById("statusList");

const tenderInfo =
    document.getElementById("tenderInfo");

const generateBtn =
    document.getElementById("generateBtn");

const generateMessage =
    document.getElementById("generateMessage");

const messageBox =
    document.getElementById("messageBox");


requirementsInput.addEventListener(
    "change",
    handleRequirements
);


pdfInput.addEventListener(
    "change",
    handlePDFUpload
);


document
    .getElementById("languageBtn")
    .addEventListener(
        "click",
        toggleLanguage
    );


generateBtn.addEventListener(
    "click",
    generatePackage
);


async function handleRequirements(event) {

    const file =
        event.target.files[0];

    if (!file) {
        return;
    }


    if (!file.name.toLowerCase().endsWith(".json")) {

        showMessage(
            "Please select a requirements.json file.",
            "error"
        );

        return;
    }


    try {

        const text =
            await file.text();

        const data =
            JSON.parse(text);


        if (
            !data.tender ||
            !Array.isArray(data.requirements)
        ) {

            throw new Error(
                "Invalid requirements.json format."
            );
        }


        state.tender =
            data.tender;

        state.requirements =
            [...data.requirements].sort(
                (a, b) => a.order - b.order
            );

        state.matches = {};
        state.expiryDates = {};


        renderTender();

        renderRequirements();

        updateEverything();


        showMessage(
            "Requirements loaded successfully.",
            "success"
        );

    } catch (error) {

        showMessage(
            error.message ||
            "Could not read requirements.json.",
            "error"
        );
    }
}


function renderTender() {

    if (!state.tender) {

        tenderInfo.classList.add(
            "hidden"
        );

        return;
    }


    tenderInfo.classList.remove(
        "hidden"
    );


    tenderInfo.innerHTML = `

        <div class="tender-grid">

            <div class="info-item">
                <span>Tender ID</span>
                <strong>
                    ${escapeHTML(
                        state.tender.tender_id
                    )}
                </strong>
            </div>

            <div class="info-item">
                <span>Title</span>
                <strong>
                    ${escapeHTML(
                        state.tender.title
                    )}
                </strong>
            </div>

            <div class="info-item">
                <span>Procuring Entity</span>
                <strong>
                    ${escapeHTML(
                        state.tender.procuring_entity
                    )}
                </strong>
            </div>

            <div class="info-item">
                <span>Bidder</span>
                <strong>
                    ${escapeHTML(
                        state.tender.bidder
                    )}
                </strong>
            </div>

            <div class="info-item">
                <span>Submission Deadline</span>
                <strong>
                    ${escapeHTML(
                        state.tender.submission_deadline
                    )}
                </strong>
            </div>

            <div class="info-item">
                <span>Required Documents</span>
                <strong>
                    ${state.requirements.length}
                </strong>
            </div>

        </div>
    `;
}


async function handlePDFUpload(event) {

    const selected =
        Array.from(event.target.files);


    if (!selected.length) {
        return;
    }


    const currentSize =
        state.files.reduce(
            (total, item) =>
                total + item.file.size,
            0
        );


    const selectedSize =
        selected.reduce(
            (total, file) =>
                total + file.size,
            0
        );


    if (
        state.files.length +
        selected.length > 30
    ) {

        showMessage(
            "Maximum 30 PDF files are allowed.",
            "error"
        );

        pdfInput.value = "";

        return;
    }


    if (
        currentSize +
        selectedSize >
        50 * 1024 * 1024
    ) {

        showMessage(
            "Total PDF size cannot exceed 50 MB.",
            "error"
        );

        pdfInput.value = "";

        return;
    }


    for (const file of selected) {

        if (
            file.type !== "application/pdf" &&
            !file.name
                .toLowerCase()
                .endsWith(".pdf")
        ) {

            showMessage(
                `${file.name} is not a PDF file.`,
                "error"
            );

            continue;
        }


        const exists =
            state.files.some(
                item =>
                    item.file.name === file.name &&
                    item.file.size === file.size
            );


        if (exists) {
            continue;
        }


        try {

            const pages =
                await getPDFPageCount(file);

            const hash =
                await getFileHash(file);


            state.files.push({
                id: crypto.randomUUID(),
                file,
                pages,
                hash,
                duplicate: false
            });

        } catch (error) {

            showMessage(
                `Could not read ${file.name}. The PDF may be damaged or password protected.`,
                "error"
            );
        }
    }


    updateDuplicateFlags();

    renderFiles();

    renderRequirements();

    updateEverything();

    pdfInput.value = "";
}


async function getPDFPageCount(file) {

    const buffer =
        await file.arrayBuffer();

    const pdf =
        await PDFLib.PDFDocument.load(
            buffer,
            {
                ignoreEncryption: false
            }
        );

    return pdf.getPageCount();
}


async function getFileHash(file) {

    const buffer =
        await file.arrayBuffer();

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            buffer
        );


    return Array
        .from(
            new Uint8Array(hashBuffer)
        )
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}


function updateDuplicateFlags() {

    const groups = {};

    state.files.forEach(item => {

        if (!groups[item.hash]) {
            groups[item.hash] = [];
        }

        groups[item.hash].push(item);
    });


    state.files.forEach(item => {

        item.duplicate =
            groups[item.hash].length > 1;
    });
}


function renderFiles() {

    document.getElementById(
        "fileCounter"
    ).textContent =
        `${state.files.length} files`;


    if (!state.files.length) {

        fileList.innerHTML =
            `<div class="empty-state">
                No PDF files uploaded yet.
            </div>`;

        return;
    }


    fileList.innerHTML = "";


    state.files.forEach(item => {

        const div =
            document.createElement("div");


        div.className =
            `file-item ${
                item.duplicate
                    ? "duplicate"
                    : ""
            }`;


        const duplicateHTML =
            item.duplicate
                ? `<span class="duplicate-badge">
                    Duplicate
                   </span>`
                : "";


        div.innerHTML = `

            <div class="file-main">

                <span class="file-icon">
                    📄
                </span>

                <div>

                    <div class="file-name">
                        ${escapeHTML(
                            item.file.name
                        )}
                    </div>

                    <div class="file-meta">
                        ${formatBytes(
                            item.file.size
                        )}
                        ·
                        ${item.pages} page(s)
                    </div>

                </div>

            </div>

            <div class="file-actions">

                ${duplicateHTML}

                <button
                    class="remove-btn"
                    onclick="removeFile('${item.id}')"
                >
                    Remove
                </button>

            </div>
        `;


        fileList.appendChild(div);
    });
}


function removeFile(id) {

    state.files =
        state.files.filter(
            item => item.id !== id
        );


    Object.keys(state.matches)
        .forEach(requirementId => {

            if (
                state.matches[requirementId] === id
            ) {

                delete state.matches[
                    requirementId
                ];
            }
        });


    updateDuplicateFlags();

    renderFiles();

    renderRequirements();

    updateEverything();
}


function renderRequirements() {

    if (!state.requirements.length) {

        requirementsList.innerHTML =
            `<div class="empty-state">
                Load requirements.json first.
            </div>`;

        return;
    }


    requirementsList.innerHTML = "";


    state.requirements.forEach(
        requirement => {

            const matchedId =
                state.matches[
                    requirement.id
                ] || "";


            const selectedFile =
                state.files.find(
                    item =>
                        item.id === matchedId
                );


            const title =
                state.language === "bn" &&
                requirement.title_bn
                    ? requirement.title_bn
                    : requirement.title_en;


            const div =
                document.createElement("div");


            div.className =
                "requirement-item";


            let options = `
                <option value="">
                    -- Select PDF file --
                </option>
            `;


            state.files.forEach(item => {

                const usedByOther =
                    Object.entries(
                        state.matches
                    ).some(
                        ([reqId, fileId]) =>
                            reqId !==
                                requirement.id &&
                            fileId === item.id
                    );


                const disabled =
                    usedByOther ||
                    item.duplicate;


                options += `
                    <option
                        value="${item.id}"
                        ${item.id === matchedId
                            ? "selected"
                            : ""}
                        ${disabled
                            ? "disabled"
                            : ""}
                    >
                        ${escapeHTML(
                            item.file.name
                        )}
                        ${
                            item.duplicate
                                ? " — Duplicate"
                                : ""
                        }
                    </option>
                `;
            });


            const expiryHTML =
                requirement.has_expiry
                    ? `
                        <input
                            class="expiry-input"
                            type="date"
                            value="${
                                state.expiryDates[
                                    requirement.id
                                ] || ""
                            }"
                            data-expiry-id="${
                                requirement.id
                            }"
                        >
                    `
                    : "";


            div.innerHTML = `

                <div class="requirement-top">

                    <div class="requirement-title">

                        <span class="order-number">
                            ${requirement.order}
                        </span>

                        <div>

                            <h3>
                                ${escapeHTML(title)}
                            </h3>

                            <p>
                                ID:
                                ${escapeHTML(
                                    requirement.id
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="badges">

                        ${
                            requirement.mandatory
                                ? `
                                    <span class="badge required">
                                        Mandatory
                                    </span>
                                  `
                                : `
                                    <span class="badge optional">
                                        Optional
                                    </span>
                                  `
                        }

                        ${
                            requirement.has_expiry
                                ? `
                                    <span class="badge expiry">
                                        Expiry Required
                                    </span>
                                  `
                                : ""
                        }

                    </div>

                </div>


                <div class="match-area">

                    <select
                        class="match-select"
                        data-match-id="${
                            requirement.id
                        }"
                    >
                        ${options}
                    </select>

                    ${
                        requirement.has_expiry
                            ? expiryHTML
                            : `
                                <div></div>
                              `
                    }

                </div>
            `;


            requirementsList.appendChild(div);
        }
    );


    document
        .querySelectorAll(
            "[data-match-id]"
        )
        .forEach(select => {

            select.addEventListener(
                "change",
                function() {

                    const id =
                        this.dataset.matchId;

                    if (this.value) {

                        state.matches[id] =
                            this.value;

                    } else {

                        delete state.matches[id];
                    }


                    renderRequirements();

                    updateEverything();
                }
            );
        });


    document
        .querySelectorAll(
            "[data-expiry-id]"
        )
        .forEach(input => {

            input.addEventListener(
                "change",
                function() {

                    state.expiryDates[
                        this.dataset.expiryId
                    ] = this.value;


                    updateEverything();
                }
            );
        });
}


function getStatus(requirement) {

    const fileId =
        state.matches[
            requirement.id
        ];


    if (!fileId) {

        if (requirement.mandatory) {

            return {
                type: "blocking",
                label: "Missing",
                reason: "Required document has no matched file."
            };

        }


        return {
            type: "warning",
            label: "Not provided",
            reason: "Optional document has no file."
        };
    }


    const file =
        state.files.find(
            item => item.id === fileId
        );


    if (!file) {

        return {
            type: "blocking",
            label: "Missing",
            reason: "Matched file no longer exists."
        };
    }


    if (file.duplicate) {

        return {
            type: "blocking",
            label: "Duplicate",
            reason: "Duplicate files cannot be matched."
        };
    }


    if (requirement.has_expiry) {

        const expiry =
            state.expiryDates[
                requirement.id
            ];


        if (!expiry) {

            return {
                type: "blocking",
                label: "Expiry date needed",
                reason: "Enter the expiry date."
            };
        }


        if (
            expiry <
            state.tender.submission_deadline
        ) {

            return {
                type: "blocking",
                label: "Expired",
                reason:
                    `Expires before the submission deadline.`
            };
        }
    }


    return {
        type: "ok",
        label: "OK",
        reason:
            `${file.file.name} matched successfully.`
    };
}


function renderStatuses() {

    if (!state.requirements.length) {

        statusList.innerHTML =
            `<div class="empty-state">
                No status available yet.
            </div>`;

        return;
    }


    statusList.innerHTML = "";


    state.requirements.forEach(
        requirement => {

            const status =
                getStatus(requirement);


            const title =
                state.language === "bn" &&
                requirement.title_bn
                    ? requirement.title_bn
                    : requirement.title_en;


            const div =
                document.createElement("div");


            div.className =
                "status-item";


            div.style.background =
                status.type === "ok"
                    ? "#f0fdf4"
                    : status.type === "blocking"
                        ? "#fff1f2"
                        : "#fffbeb";


            div.innerHTML = `

                <div class="status-left">

                    <strong>
                        ${requirement.order}.
                        ${escapeHTML(title)}
                    </strong>

                    <small>
                        ${escapeHTML(
                            status.reason
                        )}
                    </small>

                </div>

                <span class="status ${
                    status.type
                }">

                    ${status.label}

                </span>
            `;


            statusList.appendChild(div);
        }
    );
}


function updateEverything() {

    renderStatuses();


    const statuses =
        state.requirements.map(
            requirement =>
                getStatus(requirement)
        );


    const blocking =
        statuses.filter(
            status =>
                status.type === "blocking"
        );


    const ok =
        statuses.filter(
            status =>
                status.type === "ok"
        );


    const optional =
        statuses.filter(
            status =>
                status.type === "warning"
        );


    if (!state.requirements.length) {

        generateBtn.disabled = true;

        generateMessage.textContent =
            "Load requirements.json first.";

        document.getElementById(
            "statusSummary"
        ).textContent =
            "No requirements loaded";

        return;
    }


    document.getElementById(
        "statusSummary"
    ).textContent =
        `${ok.length} OK · ${
            blocking.length
        } blocking · ${
            optional.length
        } optional`;


    if (blocking.length) {

        generateBtn.disabled = true;

        generateMessage.textContent =
            `${blocking.length} blocking issue(s) must be resolved.`;

    } else {

        generateBtn.disabled = false;

        generateMessage.textContent =
            "Everything is ready. Generate the package.";
    }
}


async function generatePackage() {

    if (!state.tender) {

        showMessage(
            "Load requirements.json first.",
            "error"
        );

        return;
    }


    const blocking =
        state.requirements.filter(
            requirement =>
                getStatus(requirement)
                    .type === "blocking"
        );


    if (blocking.length) {

        showMessage(
            "Resolve all blocking issues first.",
            "error"
        );

        return;
    }


    try {

        generateBtn.disabled = true;

        generateBtn.textContent =
            "Generating...";


        const {
            PDFDocument,
            StandardFonts,
            rgb
        } = PDFLib;


        const packagePdf =
            await PDFDocument.create();


        const font =
            await packagePdf.embedFont(
                StandardFonts.Helvetica
            );


        const includedDocuments =
            state.requirements.filter(
                requirement =>
                    state.matches[
                        requirement.id
                    ]
            );


        const cover =
            packagePdf.addPage([
                595.28,
                841.89
            ]);


        const pageWidth =
            cover.getWidth();

        let y = 780;


        cover.drawText(
            "TENDER DOCUMENT PACKAGE",
            {
                x: 45,
                y,
                size: 20,
                font,
                color: rgb(
                    0.1,
                    0.2,
                    0.5
                )
            }
        );


        y -= 45;


        const coverLines = [

            `Tender ID: ${
                state.tender.tender_id
            }`,

            `Tender Title: ${
                state.tender.title
            }`,

            `Procuring Entity: ${
                state.tender.procuring_entity
            }`,

            `Bidder: ${
                state.tender.bidder
            }`,

            `Submission Deadline: ${
                state.tender.submission_deadline
            }`,

            `Package Made: ${
                new Date()
                    .toISOString()
                    .slice(0, 10)
            }`

        ];


        coverLines.forEach(line => {

            cover.drawText(
                line,
                {
                    x: 45,
                    y,
                    size: 11,
                    font
                }
            );

            y -= 23;
        });


        y -= 20;


        cover.drawText(
            "Included Documents",
            {
                x: 45,
                y,
                size: 14,
                font
            }
        );


        y -= 25;


        includedDocuments.forEach(
            requirement => {

                const title =
                    requirement.title_en ||
                    requirement.title_bn;


                const file =
                    state.files.find(
                        item =>
                            item.id ===
                            state.matches[
                                requirement.id
                            ]
                    );


                const line =
                    `${requirement.order}. ${
                        title
                    } — ${
                        file.file.name
                    }`;


                cover.drawText(
                    line.substring(0, 90),
                    {
                        x: 45,
                        y,
                        size: 9,
                        font
                    }
                );


                y -= 18;


                if (y < 60) {

                    y = 780;

                    packagePdf.addPage([
                        595.28,
                        841.89
                    ]);
                }
            }
        );


        for (
            const requirement
            of includedDocuments
        ) {

            const file =
                state.files.find(
                    item =>
                        item.id ===
                        state.matches[
                            requirement.id
                        ]
                );


            const buffer =
                await file.file.arrayBuffer();


            const sourcePdf =
                await PDFDocument.load(
                    buffer
                );


            const pages =
                await packagePdf.copyPages(
                    sourcePdf,
                    sourcePdf.getPageIndices()
                );


            pages.forEach(page => {

                packagePdf.addPage(page);
            });
        }


        const totalPages =
            packagePdf.getPageCount();


        packagePdf
            .getPages()
            .forEach(
                (page, index) => {

                    page.drawText(
                        `${
                            state.tender.tender_id
                        } | Page ${
                            index + 1
                        } of ${
                            totalPages
                        }`,
                        {
                            x: 45,
                            y: 20,
                            size: 8,
                            font,
                            color: rgb(
                                0.35,
                                0.35,
                                0.35
                            )
                        }
                    );
                }
            );


        const bytes =
            await packagePdf.save();


        const blob =
            new Blob(
                [bytes],
                {
                    type:
                        "application/pdf"
                }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;


        link.download =
            `${state.tender.tender_id}_Package.pdf`;


        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);


        showMessage(
            "Package generated successfully.",
            "success"
        );

    } catch (error) {

        console.error(error);

        showMessage(
            "Could not generate the PDF package. Please check the uploaded files.",
            "error"
        );

    } finally {

        generateBtn.disabled =
            false;

        generateBtn.textContent =
            "Generate Package";

        updateEverything();
    }
}


function toggleLanguage() {

    state.language =
        state.language === "en"
            ? "bn"
            : "en";


    const bn =
        state.language === "bn";


    document.getElementById(
        "languageBtn"
    ).textContent =
        bn
            ? "English"
            : "বাংলা";


    document.getElementById(
        "appTitle"
    ).textContent =
        bn
            ? "টেন্ডার প্যাকেজ বিল্ডার"
            : "Tender Package Builder";


    document.getElementById(
        "appSubtitle"
    ).textContent =
        bn
            ? "টেন্ডারের ডকুমেন্ট যাচাই ও প্যাকেজ তৈরি করুন"
            : "Prepare, check and combine tender documents";


    renderRequirements();

    renderStatuses();
}


function showMessage(
    message,
    type = ""
) {

    messageBox.textContent =
        message;

    messageBox.className =
        `message-box ${type}`;


    clearTimeout(
        showMessage.timer
    );


    showMessage.timer =
        setTimeout(
            () => {

                messageBox.className =
                    "message-box hidden";

            },
            3500
        );
}


function formatBytes(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        parseFloat(
            (
                bytes /
                Math.pow(
                    1024,
                    index
                )
            ).toFixed(2)
        ) +
        " " +
        units[index]
    );
}


function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text ?? "";

    return div.innerHTML;
}


renderFiles();

updateEverything();
