<?php
declare(strict_types=1);

const CONTENT_FILE = __DIR__ . '/../data/site.json';
const DEFAULT_ADMIN_EMAIL = 'admin@feuerwehr-biebertal.local';
const DEFAULT_ADMIN_PASSWORD = 'Drohne112!';

function e(mixed $value): string { return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function url(string $path): string { return $path === '/' ? '/' : '/' . ltrim($path, '/'); }
function asset(string $path): string { return '/' . ltrim($path, '/'); }

function redirect_to(string $path): never { header('Location: ' . $path, true, 303); exit; }

function content(): array {
    $raw = @file_get_contents(CONTENT_FILE);
    if ($raw === false) { throw new RuntimeException('Inhaltsdatei data/site.json ist nicht lesbar.'); }
    $data = json_decode($raw, true);
    if (!is_array($data)) { throw new RuntimeException('Inhaltsdatei data/site.json enthält ungültiges JSON.'); }
    validate_content($data);
    return $data;
}

function save_content(array $data): void {
    validate_content($data);
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) { throw new RuntimeException('Inhalte konnten nicht serialisiert werden.'); }
    $tmp = CONTENT_FILE . '.tmp';
    if (@file_put_contents($tmp, $json . PHP_EOL, LOCK_EX) === false) { throw new RuntimeException('Temporäre Inhaltsdatei konnte nicht geschrieben werden.'); }
    if (!@rename($tmp, CONTENT_FILE)) { @unlink($tmp); throw new RuntimeException('Inhaltsdatei konnte nicht ersetzt werden.'); }
}

function require_string(array $data, string $key): void {
    if (!isset($data[$key]) || trim((string)$data[$key]) === '') { throw new InvalidArgumentException("Pflichtfeld fehlt: $key"); }
}

function validate_content(array $data): void {
    foreach (['settings','pages','areas','incidents','team','equipment','gallery'] as $key) {
        if (!array_key_exists($key, $data)) { throw new InvalidArgumentException("Bereich fehlt: $key"); }
    }
    foreach (['siteName','subtitle','claim','email','phone','address'] as $key) { require_string($data['settings'], $key); }
    if (!filter_var($data['settings']['email'], FILTER_VALIDATE_EMAIL)) { throw new InvalidArgumentException('Ungültige Kontakt-E-Mail.'); }
    foreach (['heroHeadline','heroKicker','heroSubline','ctaTitle','ctaText','training','contactIntro'] as $key) { require_string($data['pages'], $key); }
    foreach ($data['incidents'] as $incident) {
        foreach (['id','title','date','place','category','status','image','description'] as $key) { require_string($incident, $key); }
        if (!preg_match('/^[a-z0-9-]+$/', (string)$incident['id'])) { throw new InvalidArgumentException('Einsatz-ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.'); }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$incident['date'])) { throw new InvalidArgumentException('Einsatzdatum muss YYYY-MM-DD sein.'); }
    }
}

function format_date(string $value): string {
    try { return (new DateTimeImmutable($value))->format('d.m.Y'); } catch (Throwable) { return $value; }
}

function slugify(string $title): string {
    $slug = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $title) ?: $title);
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?: 'einsatz';
    return trim($slug, '-') ?: 'einsatz';
}

function current_user(): ?array { return $_SESSION['user'] ?? null; }
function csrf_token(): string { if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = bin2hex(random_bytes(32)); } return $_SESSION['csrf']; }
function verify_csrf(): void { if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) { throw new RuntimeException('Ungültiges CSRF-Token.'); } }
function verify_login(string $email, string $password): ?array {
    $adminEmail = getenv('ADMIN_EMAIL') ?: DEFAULT_ADMIN_EMAIL;
    $hash = getenv('ADMIN_PASSWORD_HASH') ?: password_hash(DEFAULT_ADMIN_PASSWORD, PASSWORD_DEFAULT);
    if (strcasecmp(trim($email), $adminEmail) !== 0 || !password_verify($password, $hash)) { return null; }
    return ['email' => $adminEmail, 'role' => 'Administrator', 'mustChangePassword' => getenv('ADMIN_PASSWORD_HASH') === false];
}
