<script lang="ts">
	import { page } from '$app/state';
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
	<p class="text-primary text-sm font-semibold">Error {page.status}</p>
	<h1 class="font-display mt-1 text-3xl font-semibold">Ada yang tidak beres</h1>
	<p class="text-muted-foreground mt-3 text-sm">
		Coba muat ulang halaman. Kalau masih muncul, kirim pesan di bawah ini ke admin.
	</p>
	<pre
		class="bg-muted mt-4 overflow-x-auto rounded-2xl p-4 text-xs whitespace-pre-wrap">{page.error?.message ?? 'Internal Error'}</pre>
	<div class="mt-6 flex gap-3">
		<button
			class="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold"
			onclick={() => location.reload()}
		>
			Muat ulang
		</button>
		<a href="/" class="ring-border rounded-full px-5 py-2.5 text-sm font-semibold ring-1">Ke beranda</a>
	</div>
</main>
