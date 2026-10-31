// 인프라 카드의 색은 `bg-${theme}-500/10`처럼 JS에서 클래스 이름을 조립하므로
// Tailwind가 소스에서 찾지 못합니다. 스키마에 정의된 theme 값으로 safelist를 만듭니다.
const schema = require('./profile-schema.json');
const themes = schema.properties.infrastructure.items.properties.theme.enum;

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './assets/app.js', './profile.json'],
    safelist: themes.flatMap((t) => [`bg-${t}-500/10`, `text-${t}-500`]),
    theme: { extend: {} },
    plugins: [],
};
