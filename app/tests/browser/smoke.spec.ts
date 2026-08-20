import { test, expect } from '@playwright/test'

test('demo page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('planning-grid-poc')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Planning Grid POC' })).toBeVisible()
})
