import { canonicalId, cardSlugForPrompt } from './card-slug'
import { promptLibrary, type Prompt } from './prompts'

export type DeployedPromptMapEntry = {
  cid: string
  id: string
  slug: string | null
  text: string
  audience: Prompt['audience']
  depth: Prompt['depth']
  mode: Prompt['mode']
  category: Prompt['category']
  tags: Prompt['tags']
  active: boolean
}

export const toDeployedPromptMapEntry = (
  prompt: Prompt,
): DeployedPromptMapEntry => ({
  cid: canonicalId(prompt),
  id: prompt.id,
  slug: cardSlugForPrompt(prompt) ?? null,
  text: prompt.text,
  audience: [...prompt.audience],
  depth: prompt.depth,
  mode: prompt.mode,
  category: prompt.category,
  tags: [...prompt.tags],
  active: prompt.active,
})

export const deployedPromptMap: DeployedPromptMapEntry[] = promptLibrary
  .filter((prompt) => prompt.active)
  .map(toDeployedPromptMapEntry)

export const deployedPromptMapByCid: Record<string, DeployedPromptMapEntry> =
  Object.fromEntries(deployedPromptMap.map((entry) => [entry.cid, entry]))
