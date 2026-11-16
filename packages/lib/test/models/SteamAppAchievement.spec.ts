import { strict as assert } from "node:assert";
import { test } from "node:test";
import { makeApp } from "../e2e/app";
import { makeAppAchievement } from "../e2e/appAchievement";

test("achievement icons use the current Steam Community asset path for cached legacy URLs", () => {
	const achievement = makeAppAchievement(makeApp(3812600, "ReStory"), "ACH_TEST", "Test", 10, {
		icon: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/3812600/unlocked.jpg",
		icongray: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/3812600/locked.jpg",
	});
	assert.strictEqual(
		achievement.iconUnlocked,
		"https://shared.fastly.steamstatic.com/community_assets/images/apps/3812600/unlocked.jpg",
	);
	assert.strictEqual(
		achievement.iconLocked,
		"https://shared.fastly.steamstatic.com/community_assets/images/apps/3812600/locked.jpg",
	);
	assert.strictEqual(achievement.icon, achievement.iconUnlocked);
});

test("achievement icons preserve current URLs and other image sources", () => {
	const icon = "https://shared.fastly.steamstatic.com/community_assets/images/apps/3812600/current.jpg";
	const achievement = makeAppAchievement(makeApp(3812600, "ReStory"), "ACH_TEST", "Test", 10, {
		icon,
		icongray: "/placeholder.svg",
	});
	assert.strictEqual(achievement.iconUnlocked, icon);
	assert.strictEqual(achievement.iconLocked, "/placeholder.svg");
});
