import { Attempt, type SteamUserAchievement } from "@project/lib";
import {
	makeApp,
	makeAppAchievement,
	makeLockedUserAchievement,
	makeUnlockedUserAchievement,
	makeUser,
} from "@project/lib/test";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import Root from "./_root.svelte";

describe("FriendCards/_root", () => {
	it("renders friend cards when achievements present", async () => {
		// Create test data using our helpers
		const app = makeApp(10, "Test Game");
		const user1 = makeUser("u1");
		const user2 = makeUser("u2");

		const targetAchievement = makeAppAchievement(app, "A", "Achievement A", 50);
		const achievement1 = makeUnlockedUserAchievement(app, user1, "A", "Achievement A", 50);
		const achievement2 = makeUnlockedUserAchievement(app, user2, "B", "Achievement B", 30);

		render(Root, {
			props: {
				allAchievements: Promise.resolve(Attempt.ok([achievement1, achievement2])),
				targetAchievement: Promise.resolve(targetAchievement),
			},
		});

		await tick();

		// Expect two friend cards (cards have anchor with user id in href)
		const friendLinks = screen.getAllByTestId("friend-card-name-link");
		expect(friendLinks).toHaveLength(2);
		expect(friendLinks.some((link) => link.getAttribute("href")?.includes("/user/u1"))).toBe(true);
		expect(friendLinks.some((link) => link.getAttribute("href")?.includes("/user/u2"))).toBe(true);
	});
	it("filters out friends without unlocked target when hideLocked is true", async () => {
		const app = makeApp(10, "Test Game");
		const user1 = makeUser("u1");
		const user2 = makeUser("u2");

		const targetAchievement = makeAppAchievement(app, "A", "Achievement A", 50);
		const achievement1 = makeLockedUserAchievement(app, user1, "A", "Achievement A", 50);
		const achievement2 = makeUnlockedUserAchievement(app, user2, "A", "Achievement A", 50);

		render(Root, {
			props: {
				allAchievements: Promise.resolve(Attempt.ok([achievement1, achievement2])),
				targetAchievement: Promise.resolve(targetAchievement),
				hideLocked: true,
			},
		});

		await tick();

		const friendLinks = screen.getAllByTestId("friend-card-name-link");
		// Only u2 should remain (u1 is filtered out)
		expect(friendLinks).toHaveLength(1);
		expect(friendLinks[0]?.getAttribute("href")).toContain("/user/u2");
	});

	it("shows fallback when all friends filtered out by hideLocked", async () => {
		const app = makeApp(10, "Test Game");
		const user1 = makeUser("u1");
		const user2 = makeUser("u2");

		const targetAchievement = makeAppAchievement(app, "A", "Achievement A", 50);
		const achievement1 = makeLockedUserAchievement(app, user1, "A", "Achievement A", 50);
		const achievement2 = makeLockedUserAchievement(app, user2, "A", "Achievement A", 50);

		render(Root, {
			props: {
				allAchievements: Promise.resolve(Attempt.ok([achievement1, achievement2])),
				targetAchievement: Promise.resolve(targetAchievement),
				hideLocked: true,
			},
		});

		await tick();

		// Fallback text should be shown
		expect(screen.getByText("No friends have unlocked this achievement yet.")).toBeTruthy();
	});

	it("does not filter when hideLocked is false", async () => {
		const app = makeApp(10, "Test Game");
		const user1 = makeUser("u1");
		const user2 = makeUser("u2");

		const targetAchievement = makeAppAchievement(app, "A", "Achievement A", 50);
		const achievement1 = makeLockedUserAchievement(app, user1, "A", "Achievement A", 50);
		const achievement2 = makeUnlockedUserAchievement(app, user2, "A", "Achievement A", 50);

		render(Root, {
			props: {
				allAchievements: Promise.resolve(Attempt.ok([achievement1, achievement2])),
				targetAchievement: Promise.resolve(targetAchievement),
				hideLocked: false,
			},
		});

		await tick();

		const friendLinks = screen.getAllByTestId("friend-card-name-link");
		expect(friendLinks).toHaveLength(2);
	});

	it("shows sign in form when allAchievements is null", async () => {
		render(Root, {
			props: {
				allAchievements: Promise.resolve(null),
			},
		});

		await tick();

		expect(screen.getByTestId("friend-cards-signin-button")).toBeTruthy();
	});

	it("shows error state when achievements request fails", async () => {
		const error = new Error("Failed to load achievements");
		render(Root, {
			props: {
				allAchievements: Promise.resolve(Attempt.fail<SteamUserAchievement[]>(error)),
			},
		});

		await tick();

		// Should show error component (IndexError)
		expect(screen.getByTestId("index-error")).toBeTruthy();
	});
});
