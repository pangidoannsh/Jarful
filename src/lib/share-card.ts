import { dropPack } from '#lib/pack.js';

/** Draws the day's recap as a 1080×1350 image for Instagram/WhatsApp stories. */

export interface CardInput {
	dateLabel: string;
	count: number;
	planned: number;
	plannedDone: number;
	streak: number | null;
	/** Marbles in jar order: colour and size relative to a light one. */
	marbles: { color: string; scale: number }[];
	/** Effort points (ringan 1, sedang 2, berat 3). */
	effort: number;
	/** A few finished titles to list. */
	items: { title: string; color: string }[];
	perfect: boolean;
}

const W = 1080;
const H = 1350;
const PAPER = '#fbf7ef';
const INK = '#2f2a26';
const MUTED = '#8a7f74';
const CORAL = '#e8673a';
const GOLD = '#e9c14d';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function drawJar(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	marbles: { color: string; scale: number }[],
	glow: boolean
) {
	if (glow) {
		ctx.save();
		ctx.shadowColor = GOLD;
		ctx.shadowBlur = 60;
	}
	// lid
	ctx.fillStyle = INK;
	roundRect(ctx, x + w * 0.2, y, w * 0.6, h * 0.08, 12);
	ctx.fill();
	ctx.globalAlpha = 0.8;
	roundRect(ctx, x + w * 0.14, y + h * 0.075, w * 0.72, h * 0.05, 10);
	ctx.fill();
	ctx.globalAlpha = 1;
	// glass
	const gy = y + h * 0.13;
	const gh = h - h * 0.13;
	roundRect(ctx, x, gy, w, gh, 48);
	ctx.fillStyle = 'rgba(232,103,58,0.06)';
	ctx.fill();
	ctx.lineWidth = 12;
	ctx.strokeStyle = 'rgba(47,42,38,0.6)';
	ctx.stroke();
	if (glow) ctx.restore();

	// marbles dropped onto the pile; heavier todos are bigger
	const inner = { x: x + 24, w: w - 48, bottom: gy + gh - 24, top: gy + 30 };
	// Same rule as the app: marbles keep their size and a full jar stays full.
	const base = 30;
	const spots = dropPack(
		marbles.map((m) => base * m.scale),
		inner.x,
		inner.w,
		inner.bottom,
		[],
		inner.top
	);
	ctx.save();
	roundRect(ctx, x + 6, gy + 6, w - 12, gh - 12, 42);
	ctx.clip();
	spots.forEach((p) => {
		const { x: cx, y: cy, r, i } = p;
		ctx.beginPath();
		ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
		ctx.fillStyle = marbles[i].color;
		ctx.fill();
		const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r);
		g.addColorStop(0, 'rgba(255,255,255,0.8)');
		g.addColorStop(0.3, 'rgba(255,255,255,0.1)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fill();
	});
	ctx.restore();
	// highlight
	ctx.strokeStyle = 'rgba(255,255,255,0.55)';
	ctx.lineWidth = 10;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x + 40, gy + 50);
	ctx.lineTo(x + 40, gy + gh * 0.6);
	ctx.stroke();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
	if (ctx.measureText(text).width <= max) return text;
	let t = text;
	while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
	return t + '…';
}

export async function drawRecapCard(input: CardInput): Promise<Blob> {
	await document.fonts?.ready;
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d')!;

	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, W, H);
	// dotted paper
	ctx.fillStyle = 'rgba(47,42,38,0.07)';
	for (let y = 30; y < H; y += 44) for (let x = 30; x < W; x += 44) ctx.fillRect(x, y, 3, 3);

	const display = "'Fraunces Variable', Georgia, serif";
	const sans = "'Inter Variable', system-ui, sans-serif";

	ctx.fillStyle = INK;
	ctx.font = `600 52px ${display}`;
	ctx.fillText('Jarful', 80, 120);
	ctx.fillStyle = MUTED;
	ctx.font = `500 36px ${sans}`;
	ctx.textAlign = 'right';
	ctx.fillText(input.dateLabel, W - 80, 118);
	ctx.textAlign = 'left';

	drawJar(ctx, 80, 200, 400, 560, input.marbles, input.perfect);

	ctx.fillStyle = CORAL;
	ctx.font = `600 260px ${display}`;
	ctx.fillText(String(input.count), 540, 520);
	ctx.fillStyle = INK;
	ctx.font = `600 54px ${sans}`;
	ctx.fillText('todo selesai', 548, 600);
	ctx.fillStyle = MUTED;
	ctx.font = `400 36px ${sans}`;
	ctx.fillText(`${input.plannedDone} dari ${input.planned} rencana`, 548, 660);
	ctx.fillText(`${input.effort} poin usaha`, 548, 712);
	if (input.streak) ctx.fillText(`Streak ${input.streak} hari`, 548, 764);
	if (input.perfect) {
		ctx.fillStyle = GOLD;
		roundRect(ctx, 548, 792, 300, 64, 32);
		ctx.fill();
		ctx.fillStyle = INK;
		ctx.font = `600 32px ${sans}`;
		ctx.fillText('Hari sempurna', 578, 836);
	}

	// finished items
	ctx.font = `500 40px ${sans}`;
	let y = 940;
	for (const item of input.items.slice(0, 5)) {
		ctx.beginPath();
		ctx.arc(96, y - 13, 13, 0, Math.PI * 2);
		ctx.fillStyle = item.color;
		ctx.fill();
		ctx.fillStyle = INK;
		ctx.fillText(fit(ctx, item.title, W - 220), 130, y);
		y += 66;
	}
	if (input.items.length > 5) {
		ctx.fillStyle = MUTED;
		ctx.font = `400 34px ${sans}`;
		ctx.fillText(`+ ${input.items.length - 5} lainnya`, 130, y);
	}

	ctx.fillStyle = MUTED;
	ctx.font = `400 30px ${sans}`;
	ctx.fillText('Isi toplesmu, satu tugas setiap kali.', 80, H - 70);

	return new Promise((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar'))), 'image/png')
	);
}
