import PDFDocument from "pdfkit";

export type LearningReportDocument = {
  learnerName: string;
  generatedAt: string;
  curriculum: { title: string; selectionType: string }[];
  enrolments: { classTitle: string; status: string; learningArea?: string }[];
  assessments: {
    assessmentType: string;
    learningArea?: string;
    score?: string | null;
    maxScore?: string | null;
    percentage?: string | null;
    assessedOn?: string | null;
  }[];
  attendance: {
    status: string;
    lessonTitle?: string;
    classTitle?: string;
    startsAt?: string;
  }[];
  attendanceCounts: Record<string, number>;
  recordCounts: {
    enrolments: number;
    scores: number;
    attendance: number;
    curriculumSelections: number;
  };
};

export type CertificateDocument = {
  learnerName: string;
  courseTitle: string;
  certificateCode: string;
  issuedAt: string;
  generatedAt: string;
  score?: string | null;
};

function dateLabel(value?: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(parsed);
}

function linesForAttendance(counts: Record<string, number>): string {
  const known = ["present", "absent", "late", "excused"];
  const parts = known
    .filter(status => counts[status] > 0)
    .map(status => `${status}: ${counts[status]}`);
  return parts.length
    ? parts.join(" | ")
    : "No attendance status totals are available.";
}

function renderPdf(
  render: (document: PDFKit.PDFDocument) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 48, left: 52, right: 52 },
      info: { Creator: "Learning records PDF renderer" },
    });
    const chunks: Buffer[] = [];
    document.on("data", chunk => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      render(document);
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

function heading(
  document: PDFKit.PDFDocument,
  title: string,
  subtitle: string
) {
  document
    .fillColor("#15365a")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(title, { align: "center" });
  document.moveDown(0.35);
  document
    .fillColor("#45566c")
    .font("Helvetica")
    .fontSize(10)
    .text(subtitle, { align: "center" });
  document.moveDown(1.25);
  document
    .moveTo(52, document.y)
    .lineTo(543, document.y)
    .strokeColor("#d6e1ee")
    .stroke();
  document.moveDown(1);
}

function section(document: PDFKit.PDFDocument, title: string) {
  document.moveDown(0.55);
  document.fillColor("#15365a").font("Helvetica-Bold").fontSize(12).text(title);
  document.moveDown(0.25);
  document.fillColor("#263445").font("Helvetica").fontSize(9.5);
}

function unbrandedNotice(document: PDFKit.PDFDocument, text: string) {
  document.moveDown(1.2);
  document
    .fillColor("#5b6470")
    .font("Helvetica-Oblique")
    .fontSize(8)
    .text(text, { align: "left" });
}

export function createLearningReportPdf(
  input: LearningReportDocument
): Promise<Buffer> {
  return renderPdf(document => {
    heading(
      document,
      "LEARNING PROGRESS REPORT",
      "A factual summary of learner records available at the time of generation"
    );
    document
      .fillColor("#263445")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Learner");
    document.font("Helvetica").fontSize(11).text(input.learnerName);
    document.moveDown(0.25);
    document
      .fontSize(9)
      .fillColor("#5b6470")
      .text(`Generated: ${dateLabel(input.generatedAt)}`);

    section(document, "Recorded curriculum selections");
    if (input.curriculum.length) {
      input.curriculum.forEach(item =>
        document.text(`${item.title} - ${item.selectionType}`)
      );
    } else {
      document.text(
        "No curriculum selections are recorded in the available data."
      );
    }

    section(document, "Class enrolments");
    if (input.enrolments.length) {
      input.enrolments.forEach(item => {
        const area = item.learningArea ? ` | ${item.learningArea}` : "";
        document.text(`${item.classTitle} | ${item.status}${area}`);
      });
    } else {
      document.text("No active or completed class enrolments are recorded.");
    }

    section(document, "Assessments");
    if (input.assessments.length) {
      input.assessments.forEach(item => {
        const rawScore =
          item.score != null && item.maxScore != null
            ? `${item.score} / ${item.maxScore}`
            : item.score != null
              ? item.score
              : "Score not recorded";
        const percentage =
          item.percentage != null ? ` (${item.percentage}%)` : "";
        const area = item.learningArea ? ` | ${item.learningArea}` : "";
        document.text(
          `${item.assessmentType}${area} | ${rawScore}${percentage} | ${dateLabel(item.assessedOn)}`
        );
      });
      document
        .fontSize(8)
        .fillColor("#5b6470")
        .text(
          `Up to ${input.recordCounts.scores} assessment rows were available to this report query.`
        );
    } else {
      document.text("No assessment scores are recorded in the available data.");
    }

    section(document, "Attendance");
    document.text(
      `${input.recordCounts.attendance} attendance record(s) returned. ${linesForAttendance(input.attendanceCounts)}`
    );
    if (input.attendance.length) {
      input.attendance.forEach(item => {
        const lesson = item.lessonTitle ? `${item.lessonTitle} | ` : "";
        const className = item.classTitle ? `${item.classTitle} | ` : "";
        document.text(
          `${dateLabel(item.startsAt)} | ${className}${lesson}${item.status}`
        );
      });
    }

    unbrandedNotice(
      document,
      "Disclosure: institutional certificate/report branding and an authorized signature were not configured. This report contains only recorded learning data; it does not infer missing scores, attendance, or curriculum records. Data sections are bounded by the application's report query limits."
    );
  });
}

export function createCertificatePdf(
  input: CertificateDocument
): Promise<Buffer> {
  return renderPdf(document => {
    document.moveDown(2.2);
    document
      .lineWidth(1.5)
      .strokeColor("#9cb4ce")
      .roundedRect(42, 42, 511, 756, 12)
      .stroke();
    document.moveDown(2);
    document
      .fillColor("#15365a")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("RECORDED COURSE CERTIFICATE", {
        align: "center",
        characterSpacing: 1.2,
      });
    document.moveDown(1.8);
    document
      .fillColor("#263445")
      .font("Helvetica")
      .fontSize(13)
      .text("This certificate record names", { align: "center" });
    document.moveDown(0.6);
    document
      .fillColor("#15365a")
      .font("Helvetica-Bold")
      .fontSize(25)
      .text(input.learnerName, { align: "center" });
    document.moveDown(0.8);
    document
      .fillColor("#263445")
      .font("Helvetica")
      .fontSize(13)
      .text("for the course", { align: "center" });
    document.moveDown(0.6);
    document
      .fillColor("#15365a")
      .font("Helvetica-Bold")
      .fontSize(19)
      .text(input.courseTitle, { align: "center" });
    document.moveDown(1.5);
    document
      .fillColor("#263445")
      .font("Helvetica")
      .fontSize(10)
      .text(`Certificate code: ${input.certificateCode}`, { align: "center" });
    document.text(`Recorded issue date: ${dateLabel(input.issuedAt)}`, {
      align: "center",
    });
    if (input.score != null) {
      document.moveDown(0.3);
      document.text(`Recorded score: ${input.score}`, { align: "center" });
    }
    document.moveDown(1.2);
    document
      .fillColor("#5b6470")
      .fontSize(8)
      .text(`PDF generated: ${dateLabel(input.generatedAt)}`, {
        align: "center",
      });
    document.moveDown(2);
    document
      .fillColor("#5b6470")
      .font("Helvetica-Oblique")
      .fontSize(8)
      .text(
        "Disclosure: this unbranded PDF is generated from an existing, non-revoked certificate record. Institutional branding, authorized signature, and accreditation details were not configured; this document does not assert any external qualification.",
        { align: "center", lineGap: 4 }
      );
  });
}
