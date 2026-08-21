// functions/api/community/_lib/gamification.js
// Shared, quiet reputation/badge/notification logic used by posts.js, comments.js,
// and likes.js after the relevant action succeeds. Never blocks or throws the
// caller's main flow — failures here are logged but swallowed.

export const BADGES = {
  first_step:  { label: 'أول خطوة',          icon: '🌱' },
  discussant:  { label: 'المحاور',            icon: '🗣️' },
  reader:      { label: 'القارئ',              icon: '📖' },
  explorer:    { label: 'المستكشف',            icon: '🧭' },
  council:     { label: 'عضو مجلس البرزخ',     icon: '🏛️' },
};

export async function awardPoints(db, userId, points) {
  try {
    await db.prepare('UPDATE users SET reputation = reputation + ? WHERE id = ?').bind(points, userId).run();
  } catch (e) { console.error('awardPoints failed', e); }
}

export async function notify(db, userId, type, message, link) {
  try {
    await db.prepare(
      'INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)'
    ).bind(userId, type, message, link || null).run();
  } catch (e) { console.error('notify failed', e); }
}

async function grantBadge(db, userId, key) {
  try {
    const already = await db.prepare('SELECT id FROM user_badges WHERE user_id = ? AND badge_key = ?').bind(userId, key).first();
    if (already) return;
    await db.prepare('INSERT INTO user_badges (user_id, badge_key) VALUES (?, ?)').bind(userId, key).run();
    const badge = BADGES[key];
    if (badge) {
      await notify(db, userId, 'badge', `مبروك، حصلت على شارة "${badge.label}" ${badge.icon}`, '/majlis-space.html');
    }
  } catch (e) { console.error('grantBadge failed', e); }
}

// Call after a user creates a post, writes a comment, or gives/receives a
// reaction — cheap enough to run on every action, only touches the DB when a
// new badge is actually earned.
export async function checkAndAwardBadges(db, userId) {
  try {
    const postsRow = await db.prepare('SELECT COUNT(*) AS c FROM posts WHERE user_id = ? AND is_hidden = 0').bind(userId).first();
    const commentsRow = await db.prepare('SELECT COUNT(*) AS c FROM comments WHERE user_id = ? AND is_hidden = 0').bind(userId).first();
    const reactionsGivenRow = await db.prepare('SELECT COUNT(*) AS c FROM likes WHERE user_id = ?').bind(userId).first();
    const categoriesRow = await db.prepare(
      `SELECT COUNT(DISTINCT category) AS c FROM (
         SELECT category FROM posts WHERE user_id = ? AND is_hidden = 0
       )`
    ).bind(userId).first();
    const repRow = await db.prepare('SELECT reputation FROM users WHERE id = ?').bind(userId).first();

    const totalContributions = (postsRow?.c || 0) + (commentsRow?.c || 0);

    if ((postsRow?.c || 0) >= 1) await grantBadge(db, userId, 'first_step');
    if (totalContributions >= 20) await grantBadge(db, userId, 'discussant');
    if ((reactionsGivenRow?.c || 0) >= 20) await grantBadge(db, userId, 'reader');
    if ((categoriesRow?.c || 0) >= 3) await grantBadge(db, userId, 'explorer');
    if ((repRow?.reputation || 0) >= 50) await grantBadge(db, userId, 'council');
  } catch (e) { console.error('checkAndAwardBadges failed', e); }
}
