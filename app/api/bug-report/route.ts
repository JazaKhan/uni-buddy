import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { checkRateLimit } from "@/lib/rateLimit";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const allowed = await checkRateLimit(ip, "general");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests — please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: unknown; description?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const page =
    typeof body.page === "string" ? body.page.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 }
    );
  }
  if (!description) {
    return NextResponse.json(
      { error: "A description of the issue is required" },
      { status: 400 }
    );
  }

  const notifyAddress = process.env.NOTIFY_EMAIL;
  if (!notifyAddress) {
    console.error("NOTIFY_EMAIL is not set — bug report dropped");
    return NextResponse.json({ success: true });
  }

  const subjectSnippet =
    description.length > 50 ? description.slice(0, 50) + "…" : description;
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "Uni Buddy <onboarding@resend.dev>";

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: notifyAddress,
      subject: `[Uni Buddy Bug Report] ${subjectSnippet}`,
      text: [
        `From: ${email}`,
        `Page: ${page || "not specified"}`,
        "",
        description,
      ].join("\n"),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Failed to submit report — please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Bug report route error:", err);
    return NextResponse.json(
      { error: "Something went wrong — please try again." },
      { status: 500 }
    );
  }
}
