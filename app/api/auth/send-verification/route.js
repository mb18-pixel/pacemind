import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, confirmationUrl } = await request.json();
    
    if (!email || !confirmationUrl) {
      return Response.json(
        { error: 'Email and confirmationUrl are required' },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: 'Ascend <onboarding@resend.dev>',
      to: email,
      subject: 'Bestätige deine E-Mail – Ascend',
      html: `
        <div style="background:#0a0a0a;color:#fff;
          font-family:sans-serif;padding:40px;
          max-width:500px;margin:0 auto;">
          <h1 style="color:#e63228;font-size:32px;
            margin:0 0 8px;">ASCEND</h1>
          <p style="color:#888;margin:0 0 32px;">
            BY PERFORMANCEPROTOKOLL</p>
          <h2 style="font-size:20px;margin:0 0 16px;">
            Fast geschafft.</h2>
          <p style="color:#ccc;margin:0 0 24px;">
            Klicke auf den Button um deine E-Mail zu 
            bestätigen und deinen Coach zu starten.</p>
          <a href="${confirmationUrl}" 
            style="background:#e63228;color:#fff;
            padding:14px 28px;text-decoration:none;
            font-weight:bold;display:inline-block;
            border-radius:4px;">
            E-MAIL BESTÄTIGEN →
          </a>
          <p style="color:#555;font-size:12px;margin:32px 0 0;">
            Falls du dich nicht registriert hast, 
            ignoriere diese E-Mail.</p>
        </div>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Send verification email error:', error);
    return Response.json(
      { error: error.message || 'E-Mail konnte nicht gesendet werden' },
      { status: 500 }
    );
  }
}