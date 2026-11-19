<script lang="ts">
	import { Share2Icon, DownloadIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { drawRecapCard, type CardInput } from '#lib/share-card.js';

	let { input, fileName }: { input: () => CardInput; fileName: string } = $props();

	let open = $state(false);
	let url = $state<string | null>(null);
	let blob: Blob | null = null;

	async function make() {
		open = true;
		try {
			blob = await drawRecapCard(input());
			if (url) URL.revokeObjectURL(url);
			url = URL.createObjectURL(blob);
		} catch (e) {
			toast.error((e as Error).message);
			open = false;
		}
	}

	async function share() {
		if (!blob) return;
		const file = new File([blob], fileName, { type: 'image/png' });
		try {
			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file], title: 'Rekap Jarful' });
				return;
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
		}
		download();
	}

	function download() {
		if (!url) return;
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		a.click();
	}
</script>

<Button variant="outline" class="h-12 flex-1 rounded-full" onclick={make}>
	<Share2Icon class="size-4" /> Bagikan rekap
</Button>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Kartu rekap</Dialog.Title>
			<Dialog.Description>Bagikan ke Story atau WhatsApp sebagai pengingat untuk dirimu dan temanmu.</Dialog.Description>
		</Dialog.Header>
		{#if url}
			<img src={url} alt="Kartu rekap hari ini" class="ring-border w-full rounded-2xl ring-1" />
		{:else}
			<div class="bg-muted aspect-[4/5] w-full animate-pulse rounded-2xl"></div>
		{/if}
		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={download} disabled={!url}><DownloadIcon class="size-4" /> Unduh</Button>
			<Button onclick={share} disabled={!url}><Share2Icon class="size-4" /> Bagikan</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
