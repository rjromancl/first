/**
 * translations.js — i18n for the BA mobile app.
 * 8 languages matching the web app.
 */

export const LANGUAGES = [
  { code: 'en-GB', label: '🇬🇧 EN', name: 'English (UK)' },
  { code: 'hi-IN', label: '🇮🇳 HI', name: 'Hindi' },
  { code: 'ta-IN', label: '🇮🇳 TA', name: 'Tamil' },
  { code: 'es-ES', label: '🇪🇸 ES', name: 'Español' },
  { code: 'fr-FR', label: '🇫🇷 FR', name: 'Français' },
  { code: 'de-DE', label: '🇩🇪 DE', name: 'Deutsch' },
  { code: 'ja-JP', label: '🇯🇵 JA', name: '日本語' },
  { code: 'ar-SA', label: '🇸🇦 AR', name: 'العربية' },
];

const translations = {
  'en-GB': {
    welcome: "Hi! Where would you like to fly?",
    listening: "Listening...",
    tap_mic: "Tap mic to speak",
    book_flight: "Book a flight",
    check_in: "Check in",
    flight_status: "Flight status",
    my_avios: "My Avios",
    thinking: "Thinking...",
    error: "Sorry, something went wrong. Please try again.",
    mic_permission: "Microphone access is needed for voice commands.",
  },
  'hi-IN': {
    welcome: "नमस्ते! आप कहाँ उड़ना चाहते हैं?",
    listening: "सुन रहा हूँ...",
    tap_mic: "बोलने के लिए माइक टैप करें",
    book_flight: "उड़ान बुक करें",
    check_in: "चेक इन",
    flight_status: "उड़ान स्थिति",
    my_avios: "मेरा Avios",
    thinking: "सोच रहा हूँ...",
    error: "माफ़ करें, कुछ गलत हुआ। कृपया पुनः प्रयास करें।",
    mic_permission: "वॉयस कमांड के लिए माइक्रोफ़ोन एक्सेस आवश्यक है।",
  },
  'ta-IN': {
    welcome: "வணக்கம்! நீங்கள் எங்கு பறக்க விரும்புகிறீர்கள்?",
    listening: "கேட்கிறேன்...",
    tap_mic: "பேச மைக்கை தட்டவும்",
    book_flight: "விமானம் பதிவு செய்யுங்கள்",
    check_in: "செக் இன்",
    flight_status: "விமான நிலை",
    my_avios: "என் Avios",
    thinking: "யோசிக்கிறேன்...",
    error: "மன்னிக்கவும், ஏதோ தவறு நடந்தது.",
    mic_permission: "குரல் கட்டளைகளுக்கு மைக்ரோஃபோன் அணுகல் தேவை.",
  },
  'es-ES': {
    welcome: "¡Hola! ¿A dónde quieres volar?",
    listening: "Escuchando...",
    tap_mic: "Toca el micrófono para hablar",
    book_flight: "Reservar vuelo",
    check_in: "Facturar",
    flight_status: "Estado del vuelo",
    my_avios: "Mis Avios",
    thinking: "Pensando...",
    error: "Lo siento, algo salió mal. Por favor inténtalo de nuevo.",
    mic_permission: "Se necesita acceso al micrófono para los comandos de voz.",
  },
  'fr-FR': {
    welcome: "Bonjour ! Où souhaitez-vous voler ?",
    listening: "J'écoute...",
    tap_mic: "Appuyez sur le micro pour parler",
    book_flight: "Réserver un vol",
    check_in: "Enregistrement",
    flight_status: "Statut du vol",
    my_avios: "Mes Avios",
    thinking: "Réflexion...",
    error: "Désolé, une erreur s'est produite. Veuillez réessayer.",
    mic_permission: "L'accès au microphone est nécessaire pour les commandes vocales.",
  },
  'de-DE': {
    welcome: "Hallo! Wohin möchten Sie fliegen?",
    listening: "Ich höre zu...",
    tap_mic: "Mikrofon antippen, um zu sprechen",
    book_flight: "Flug buchen",
    check_in: "Einchecken",
    flight_status: "Flugstatus",
    my_avios: "Meine Avios",
    thinking: "Nachdenken...",
    error: "Entschuldigung, etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    mic_permission: "Mikrofonzugriff für Sprachbefehle erforderlich.",
  },
  'ja-JP': {
    welcome: "こんにちは！どこへ飛びたいですか？",
    listening: "聞いています...",
    tap_mic: "マイクをタップして話す",
    book_flight: "フライトを予約",
    check_in: "チェックイン",
    flight_status: "フライト状況",
    my_avios: "マイAvios",
    thinking: "考え中...",
    error: "申し訳ありませんが、エラーが発生しました。",
    mic_permission: "音声コマンドにはマイクのアクセスが必要です。",
  },
  'ar-SA': {
    welcome: "مرحباً! إلى أين تريد السفر؟",
    listening: "أستمع...",
    tap_mic: "اضغط على الميكروفون للتحدث",
    book_flight: "حجز رحلة",
    check_in: "تسجيل الوصول",
    flight_status: "حالة الرحلة",
    my_avios: "نقاطي Avios",
    thinking: "أفكر...",
    error: "عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    mic_permission: "الوصول إلى الميكروفون مطلوب للأوامر الصوتية.",
  },
};

export function getTranslation(lang, key) {
  return (
    translations[lang]?.[key] ||
    translations['en-GB']?.[key] ||
    key
  );
}

export default translations;
