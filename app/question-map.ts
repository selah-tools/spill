import { canonicalId, cardSlugForQuestion } from './card-slug'
import { questionLibrary, type Question } from './questions'

export type DeployedQuestionMapEntry = {
  cid: string
  id: string
  slug: string | null
  text: string
  audience: Question['audience']
  depth: Question['depth']
  mode: Question['mode']
  category: Question['category']
  tags: Question['tags']
  active: boolean
}

export const toDeployedQuestionMapEntry = (
  question: Question,
): DeployedQuestionMapEntry => ({
  cid: canonicalId(question),
  id: question.id,
  slug: cardSlugForQuestion(question) ?? null,
  text: question.text,
  audience: [...question.audience],
  depth: question.depth,
  mode: question.mode,
  category: question.category,
  tags: [...question.tags],
  active: question.active,
})

export const getDeployedQuestionMap = (): DeployedQuestionMapEntry[] =>
  questionLibrary
    .filter((question) => question.active)
    .map(toDeployedQuestionMapEntry)

export const getDeployedQuestionMapByCid = (): Record<
  string,
  DeployedQuestionMapEntry
> => {
  const map = getDeployedQuestionMap()
  return Object.fromEntries(map.map((entry) => [entry.cid, entry]))
}
