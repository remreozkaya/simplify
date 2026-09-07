import { translations, type Language } from "@/lib/i18n/translations";

const runtimeMessages: Record<string, string> = {
  "Email is required.": "E-posta gereklidir.",
  "Enter a valid email address.": "Geçerli bir e-posta adresi girin.",
  "Password is required.": "Parola gereklidir.",
  "Passwords do not match.": "Parolalar eşleşmiyor.",
  "Current password is required.": "Geçerli parola gereklidir.",
  "Current password is incorrect.": "Geçerli parola yanlış.",
  "Use at least 8 characters.": "En az 8 karakter kullanın.",
  "Check the highlighted fields and try again.":
    "Vurgulanan alanları kontrol edip yeniden deneyin.",
  "Check the highlighted password fields.":
    "Vurgulanan parola alanlarını kontrol edin.",
  "Your email address has not been verified.":
    "E-posta adresiniz doğrulanmamış.",
  "This password reset link is invalid or has expired.":
    "Bu parola sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
  "You can now log in with your new password.":
    "Artık yeni parolanızla giriş yapabilirsiniz.",
  "Your email is verified. You can now log in.":
    "E-postanız doğrulandı. Artık giriş yapabilirsiniz.",
  "Check your inbox and verify your email before signing in.":
    "Giriş yapmadan önce gelen kutunuzu kontrol edin ve e-postanızı doğrulayın.",
  "Your session has expired. Sign in again to save your profile.":
    "Oturumunuz sona erdi. Profilinizi kaydetmek için yeniden giriş yapın.",
  "Your profile could not be saved right now. Try again.":
    "Profiliniz şu anda kaydedilemedi. Yeniden deneyin.",
  "Profile saved.": "Profil kaydedildi.",
  "Password changed.": "Parola değiştirildi.",
  "The request failed.": "İstek başarısız oldu.",
  "Faculties could not be loaded.": "Fakülteler yüklenemedi.",
  "Programs could not be loaded.": "Programlar yüklenemedi.",
  "Curriculum plans could not be loaded.": "Ders planları yüklenemedi.",
  "Curriculum versions could not be loaded.":
    "Ders planı sürümleri yüklenemedi.",
  "Curriculum could not be loaded from İTÜ OBS.":
    "Müfredat İTÜ OBS'den yüklenemedi.",
  "Your academic programs could not be loaded.":
    "Akademik programlarınız yüklenemedi.",
  "Term must be numeric.": "Dönem sayısal olmalıdır.",
  "CRN must be numeric.": "CRN sayısal olmalıdır.",
  "Course code is required.": "Ders kodu gereklidir.",
  "Course name is required.": "Ders adı gereklidir.",
  "Course code is invalid.": "Ders kodu geçersiz.",
  "Credit must be a number or counted/transcript pair.":
    "Kredi bir sayı veya sayılan/transkript çifti olmalıdır.",
  "Course row appears outside a recognized section.":
    "Ders satırı tanınan bir bölümün dışında görünüyor.",
  "Invalid email or password.": "E-posta veya parola yanlış.",
  "Password must contain at least 8 characters.":
    "Parola en az 8 karakter olmalıdır.",
  "Password must contain no more than 128 characters.":
    "Parola en fazla 128 karakter olabilir.",
  "New password must be different from your current password.":
    "Yeni parola geçerli parolanızdan farklı olmalıdır.",
  "Too many attempts. Please wait a moment and try again.":
    "Çok fazla deneme yapıldı. Biraz bekleyip yeniden deneyin.",
  "Too many requests. Please wait before trying again.":
    "Çok fazla istek gönderildi. Biraz bekleyip yeniden deneyin.",
  "Unable to sign in right now. Try again.":
    "Şu anda giriş yapılamıyor. Yeniden deneyin.",
  "Unable to create your account right now. Try again.":
    "Hesabınız oluşturulamadı. Yeniden deneyin.",
  "Unable to resend the verification email right now. Try again.":
    "Doğrulama e-postası gönderilemedi. Yeniden deneyin.",
  "Unable to send a reset link right now. Try again.":
    "Sıfırlama bağlantısı gönderilemedi. Yeniden deneyin.",
  "Unable to update your password right now. Try again.":
    "Parolanız güncellenemedi. Yeniden deneyin.",
  "Please wait before requesting another verification email.":
    "Yeni doğrulama e-postası istemeden önce bekleyin.",
  "Verification email sent.": "Doğrulama e-postası gönderildi.",
  "If an account exists for this email, a password reset link has been sent.":
    "Bu e-postayla bir hesap varsa parola sıfırlama bağlantısı gönderildi.",
  "This verification link is invalid or has expired.":
    "Doğrulama bağlantısı geçersiz veya süresi dolmuş.",
  "Your session has expired. Sign in again.":
    "Oturumunuz sona erdi. Yeniden giriş yapın.",
  "Authentication required.": "Devam etmek için giriş yapın.",
  "Your session has expired. Sign in again to change your password.":
    "Oturumunuz sona erdi. Parolanızı değiştirmek için yeniden giriş yapın.",
  "Your password is managed by your sign-in provider.":
    "Parolanız giriş sağlayıcınız tarafından yönetiliyor.",
  "Your current password is incorrect.": "Geçerli parolanız yanlış.",
  "Your password could not be changed right now. Try again.":
    "Parolanız değiştirilemedi. Yeniden deneyin.",
  "Check the highlighted profile fields and try again.":
    "Vurgulanan profil alanlarını kontrol edip yeniden deneyin.",
  "A selected program is not available for its faculty and curriculum type.":
    "Seçilen program bu fakülte ve ders planı türü için uygun değil.",
  "Review the faculty, program, and enrollment type selections.":
    "Fakülte, program ve kayıt türünü kontrol edin.",
  "A selected curriculum plan is no longer eligible for this enrollment.":
    "Seçilen ders planı bu kayıt için artık uygun değil.",
  "Select an available curriculum plan.": "Uygun bir ders planı seçin.",
  "The selected secondary plan is not available to the main program.":
    "Seçilen ikincil plan anadal için uygun değil.",
  "Select a plan associated with the main program.":
    "Anadalla ilişkili bir ders planı seçin.",
  "Select a faculty.": "Fakülte seçin.",
  "The selected faculty is invalid.": "Seçilen fakülte geçersiz.",
  "Select a program.": "Program seçin.",
  "The selected program is invalid.": "Seçilen program geçersiz.",
  "Select a valid curriculum plan.": "Geçerli bir ders planı seçin.",
  "Select a curriculum plan.": "Ders planı seçin.",
  "Enter a valid birthdate.": "Geçerli bir doğum tarihi girin.",
  "Birthdate cannot be in the future.": "Doğum tarihi gelecekte olamaz.",
  "Too many academic programs have been added.":
    "Çok fazla akademik program eklendi.",
  "Select exactly one main program and curriculum plan.":
    "Bir anadal ve ders planı seçin.",
  "The selected curriculum type does not match the enrollment type.":
    "Ders planı türü kayıt türüyle eşleşmiyor.",
  "A secondary curriculum must reference the main program.":
    "İkincil ders planı anadalla ilişkili olmalıdır.",
  "The same program and curriculum plan cannot be added twice.":
    "Aynı program ve ders planı iki kez eklenemez.",
  "The main program cannot also be a secondary program.":
    "Anadal ikincil program olarak eklenemez.",
  "Name is required.": "Ad gereklidir.",
  "Surname is required.": "Soyad gereklidir.",
  "The exact course code appears in multiple curriculum requirements.":
    "Aynı ders kodu birden fazla gereklilikte yer alıyor.",
  "The Turkish/English course counterpart maps to multiple curriculum requirements.":
    "Türkçe/İngilizce karşılığı birden fazla gereklilikle eşleşiyor.",
  "Multiple official equivalence matches have equal priority; review is required.":
    "Birden fazla eş öncelikli resmî denklik var; inceleyin.",
  "A failed course cannot satisfy a curriculum requirement.":
    "Başarısız ders bir müfredat gerekliliğini karşılayamaz.",
  "No eligible direct, equivalent, or elective requirement uses this course code.":
    "Bu ders için uygun doğrudan, denk veya seçmeli gereklilik bulunamadı.",
  "JPEG export is not supported by this browser.":
    "Bu tarayıcı JPEG dışa aktarımını desteklemiyor.",
  "No undergraduate programs were returned by İTÜ OBS.":
    "İTÜ OBS lisans programı döndürmedi.",
  "No curriculum versions are available for this program.":
    "Bu program için ders planı bulunmuyor.",
  "Academic programs could not be loaded.": "Akademik programlar yüklenemedi.",
  "Course offerings could not be loaded.": "Ders açılışları yüklenemedi.",
  "İTÜ course branches are temporarily unavailable.":
    "İTÜ ders grupları geçici olarak kullanılamıyor.",
  "The course branches could not be loaded.": "Ders grupları yüklenemedi.",
  "İTÜ course branches could not be loaded.": "İTÜ ders grupları yüklenemedi.",
  "The course catalog could not be loaded.": "Ders kataloğu yüklenemedi.",
  "The branches API returned an invalid response.":
    "Ders grubu verileri geçersiz.",
  "The branches API returned malformed branch data.":
    "Ders grubu verileri geçersiz.",
  "A valid branchId and branchCode are required.":
    "Geçerli bir ders grubu seçin.",
  "A valid plan and undergraduate program are required.":
    "Geçerli bir ders planı ve lisans programı seçin.",
  "A valid curriculum type is required.": "Geçerli bir ders planı türü seçin.",
  "A valid undergraduate program code is required.":
    "Geçerli bir lisans programı seçin.",
  "This plan does not belong to the selected program.":
    "Bu ders planı seçilen programa ait değil.",
  "The curriculum is temporarily unavailable from İTÜ OBS.":
    "İTÜ OBS müfredatı geçici olarak kullanılamıyor.",
  "The curriculum could not be loaded.": "Müfredat yüklenemedi.",
  "Faculties are temporarily unavailable from İTÜ OBS.":
    "İTÜ OBS fakülteleri geçici olarak kullanılamıyor.",
  "Curriculum versions are temporarily unavailable from İTÜ OBS.":
    "İTÜ OBS ders planları geçici olarak kullanılamıyor.",
  "Programs are temporarily unavailable from İTÜ OBS.":
    "İTÜ OBS programları geçici olarak kullanılamıyor.",
  "Select a valid faculty and plan type.":
    "Geçerli bir fakülte ve ders planı türü seçin.",
  "Failed to fetch": "Bağlantı kurulamadı. Yeniden deneyin.",
  "Load failed": "Yüklenemedi. Yeniden deneyin.",
  "Name must contain no more than {count} characters.":
    "Ad en fazla {count} karakter olabilir.",
  "Surname must contain no more than {count} characters.":
    "Soyad en fazla {count} karakter olabilir.",
  "Nickname must contain no more than {count} characters.":
    "Takma ad en fazla {count} karakter olabilir.",
  "Unknown grade: {grade}.": "Bilinmeyen not: {grade}.",
  "Older duplicate attempt for {code}; the most recent term is used.":
    "{code} için eski tekrar kaydı; en güncel dönem kullanılır.",
  "Official equivalence for {code} requires all of: {courses}.":
    "{code} resmî denkliği için şu derslerin tümü gerekir: {courses}.",
  "This course could satisfy {count} curriculum requirements through equivalence.":
    "Bu ders denklik yoluyla {count} gerekliliği karşılayabilir.",
  "The {code} catalog response is invalid.": "{code} katalog yanıtı geçersiz.",
  "No İTÜ branch was found for {code}.":
    "{code} için İTÜ ders grubu bulunamadı.",
  "{code} courses could not be loaded.": "{code} dersleri yüklenemedi.",
  "{code} courses are temporarily unavailable.":
    "{code} dersleri geçici olarak kullanılamıyor.",
};

function messagePairs(en: unknown, tr: unknown): [string, string][] {
  if (typeof en === "string" && typeof tr === "string") return [[en, tr]];
  if (!en || !tr || typeof en !== "object" || typeof tr !== "object") return [];
  return Object.keys(en).flatMap((key) =>
    messagePairs(
      (en as Record<string, unknown>)[key],
      (tr as Record<string, unknown>)[key],
    ),
  );
}

// Both directions let already-visible validation and success messages follow
// a language change without rerunning a form submission or an import.
const pairs = [
  ...Object.entries(runtimeMessages),
  ...messagePairs(translations.en, translations.tr),
];
const exact = {
  tr: new Map(pairs.map(([en, tr]) => [en, tr])),
  en: new Map(pairs.map(([en, tr]) => [tr, en])),
};
const templates = pairs
  .filter(([en]) => en.includes("{"))
  .map(([en, tr]) => ({ en, tr }));

function translateTemplate(source: string, target: string, message: string) {
  const names: string[] = [];
  const pattern = source
    .split(/(\{\w+\})/)
    .map((part) => {
      if (/^\{\w+\}$/.test(part)) {
        names.push(part.slice(1, -1));
        return "(.+?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  const match = message.match(new RegExp(`^${pattern}$`, "u"));
  if (!match) return undefined;
  const values = Object.fromEntries(
    names.map((name, index) => [name, match[index + 1]]),
  );
  return target.replace(
    /\{(\w+)\}/g,
    (_, name: string) => values[name] ?? `{${name}}`,
  );
}

export function localizeRuntimeMessage(language: Language, message?: string) {
  if (!message) return message;
  const translated = exact[language].get(message);
  if (translated) return translated;
  const source = language === "tr" ? "en" : "tr";
  for (const template of templates) {
    const result = translateTemplate(
      template[source],
      template[language],
      message,
    );
    if (result) return result;
  }
  return message;
}
