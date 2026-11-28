// tossClient.ts — 토스 결제 승인 API 어댑터
// fetch·Basic 인증·토스 네이밍을 한 곳에 격리 → confirm은 "성공/실패"만 알면 됨 + 테스트 시 목킹 가능

export type TossConfirmResult =
  | { ok: true; data: Record<string, unknown> } // 승인 성공 (+ 토스 응답)
  | { ok: false; message?: string }; // 승인 거부 (+ 사유)

export async function confirmPayment(params: {
  paymentKey: string;
  orderId: string; // = payments.order_uid (토스 규약상 orderId)
  amount: number;
}): Promise<TossConfirmResult> {
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(process.env.TOSS_SECRET_KEY! + ':').toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    return { ok: false, message: (errBody as { message?: string }).message };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, data };
}
