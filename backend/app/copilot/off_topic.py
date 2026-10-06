"""Fixed (non-model) replies for messages the gate rejects, localised to the languages the ERP supports."""
import random

OFF_TOPIC = {
    "English": [
        "I can only help with school and study topics, so let's get back to that whenever you're ready.",
        "That's outside what I can help with here. Ask me something about your studies or school instead.",
        "Let's keep this chat focused on learning and school, I'm happy to help with that.",
    ],
    "Arabic": [
        "أستطيع المساعدة فقط في أمور الدراسة والمدرسة، فلنعد إلى ذلك متى شئت.",
        "هذا خارج ما أستطيع المساعدة فيه هنا. اسألني عن دراستك أو مدرستك.",
        "لنُبقِ هذه المحادثة مركّزة على التعلّم والمدرسة، يسعدني مساعدتك في ذلك.",
    ],
    "Hindi": [
        "मैं केवल पढ़ाई और स्कूल से जुड़े विषयों में मदद कर सकता/सकती हूं, जब आप तैयार हों, उसी पर लौटते हैं।",
        "यह मेरी मदद के दायरे से बाहर है। कृपया अपनी पढ़ाई या स्कूल से जुड़ा कुछ पूछें।",
    ],
    "Tamil": [
        "படிப்பு மற்றும் பள்ளி தொடர்பான தலைப்புகளில் மட்டுமே என்னால் உதவ முடியும், தயாரானதும் அதற்குத் திரும்புவோம்.",
        "இது என் உதவிக்கு அப்பாற்பட்டது. உங்கள் படிப்பு அல்லது பள்ளி பற்றி கேளுங்கள்.",
    ],
}

INAPPROPRIATE = {
    "English": "I can't help with that. This chat is for school and study topics only, so let's get back to that whenever you're ready.",
    "Arabic": "لا أستطيع المساعدة في ذلك. هذه المحادثة مخصّصة لأمور الدراسة والمدرسة فقط.",
    "Hindi": "मैं इसमें मदद नहीं कर सकता/सकती। यह चैट केवल पढ़ाई और स्कूल के विषयों के लिए है।",
    "Tamil": "இதில் என்னால் உதவ முடியாது. இந்த உரையாடல் படிப்பு மற்றும் பள்ளி தலைப்புகளுக்கு மட்டுமே.",
}

LANGUAGES = list(OFF_TOPIC)


def off_topic_reply(language: str) -> str:
    return random.choice(OFF_TOPIC.get(language, OFF_TOPIC["English"]))


def inappropriate_reply(language: str) -> str:
    return INAPPROPRIATE.get(language, INAPPROPRIATE["English"])
