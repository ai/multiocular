<script lang="ts">
  import { UpdateType, type UpdateTypeValue } from '../../common/stores.ts'
  import type { DependencyVersion } from '../../common/types.ts'
  import { formatVersion, formatVersionParts } from '../stores/change.ts'

  let {
    highlight,
    update,
    version
  }: {
    highlight: boolean
    update: UpdateTypeValue
    version: DependencyVersion
  } = $props()

  let value = $derived(formatVersion(version))
  let parts = $derived(formatVersionParts(version))
</script>

{#if parts}
  {parts[1]}<span class:is-changed={highlight && update === UpdateType.MAJOR}
    >{parts[2]}</span
  >{#if parts[3] !== undefined}.<span
      class:is-changed={highlight && update === UpdateType.MINOR}
      >{parts[3]}</span
    >{/if}{#if parts[4] !== undefined}.<span
      class:is-changed={highlight && update === UpdateType.PATCH}
      >{parts[4]}{parts[5]}</span
    >{:else}{parts[5]}{/if}
{:else}
  {value}
{/if}

<style>
  .is-changed {
    font-weight: bold;
    color: var(--text-color);
  }
</style>
