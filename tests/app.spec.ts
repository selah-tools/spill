import { expect, test } from '@playwright/test'

test('loads the landing screen and opens filters', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Spill' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Draw a card' })).toBeVisible()

  await page
    .getByRole('button', { name: 'Configure packs and filters' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
})

test('draws a card and shows the prompt controls', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Draw a card' }).click()

  await expect(page.getByRole('button', { name: 'New card' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adjust packs' })).toBeVisible()
  await expect(page.locator('.card-prompt')).not.toContainText(
    'Draw a card. Spill something real.',
  )
})

test('opens and submits the downvote modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Draw a card' }).click()
  await page.getByRole('button', { name: 'Rate down' }).click()

  const dialog = page.locator('#downvote-modal')
  await expect(dialog).toBeVisible()
  await page
    .getByPlaceholder('Too vague, too personal, not relevant…')
    .fill('Smoke test feedback')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(dialog).toBeHidden()
})
