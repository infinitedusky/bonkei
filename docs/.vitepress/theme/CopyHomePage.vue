<script setup lang="ts">
// The home page's Copy page button. vitepress-plugin-llms' own button turns the address /docs/ into /docs.md (it drops the trailing
// slash before adding .md), which is not a file; this one asks its composable for /docs/index.md, the home page's Markdown.
// Same classes as the plugin's button, so telemetry.ts sees its clicks.
import { withBase } from 'vitepress'
import { useCopyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms/vitepress-components'

const { copied, copyAsMarkdown } = useCopyOrDownloadAsMarkdownButtons({ currentURL: typeof location === 'undefined' ? undefined : location.origin + withBase('/index') })
</script>

<template>
  <div class="markdown-copy-buttons bonkei-copy-home"><button class="copy-page" type="button" @click="copyAsMarkdown">{{ copied ? 'Copied' : 'Copy page' }}</button></div>
</template>
