<?php
declare(strict_types=1);
require_once __DIR__ . '/content.php';

function render_header(array $c, string $title = ''): void { ?>
<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title><?= e($title ? "$title – " : '') ?><?= e($c['settings']['siteName']) ?> · <?= e($c['settings']['subtitle']) ?></title><link rel="stylesheet" href="<?= asset('styles.css') ?>"></head><body>
<header class="top"><a class="brand" href="/"><div class="crest">⚒</div><div><b><?= e($c['settings']['siteName']) ?></b><span><?= e($c['settings']['subtitle']) ?></span></div></a><nav><?php foreach ([['/','Start'],['/einsaetze','Einsätze'],['/technik','Technik'],['/team','Team'],['/ausbildung','Ausbildung'],['/galerie','Galerie'],['/kontakt','Kontakt']] as [$href,$label]): ?><a href="<?= e($href) ?>"><?= e($label) ?></a><?php endforeach; ?></nav><a class="emergency" href="tel:112">☎ Notruf<br><b>112</b></a></header>
<?php }

function render_footer(array $c): void { ?>
<footer class="footer"><div><div class="brand footer-brand"><div class="crest">⚒</div><div><b><?= e($c['settings']['siteName']) ?></b><span><?= e($c['settings']['subtitle']) ?></span></div></div><p><?= e($c['settings']['claim']) ?></p></div><div><h3>Kontakt</h3><p><?= e($c['settings']['address']) ?></p><p><?= e($c['settings']['email']) ?></p><p><?= e($c['settings']['phone']) ?></p></div><div><h3>Folge uns</h3><?php foreach (($c['settings']['socials'] ?? []) as $k=>$v): ?><a href="<?= e((string)$v) ?>"><?= e((string)$k) ?></a><?php endforeach; ?></div><div><h3>Wichtige Links</h3><a href="/datenschutz">Datenschutzerklärung</a><a href="/impressum">Impressum</a><a href="/admin">Admin</a></div><small>© <?= date('Y') ?> Freiwillige Feuerwehr Biebertal – Fachgruppe Drohne</small></footer></body></html>
<?php }

function page_hero(string $title, string $text = ''): void { ?><div class="page-hero"><h1><?= e($title) ?></h1><?php if ($text): ?><p><?= e($text) ?></p><?php endif; ?></div><?php }
function img_tag(string $src, string $class, string $alt = ''): void { ?><img class="<?= e($class) ?>" src="<?= e($src) ?>" alt="<?= e($alt) ?>" loading="lazy"><?php }
