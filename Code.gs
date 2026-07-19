/**
 * Code.gs — Backend del "Muro de Recuerdos" en Google Apps Script
 * ------------------------------------------------------------------
 * QUÉ HACE
 *  - Recibe fotos/videos en Base64 desde script.js y los guarda en
 *    Google Drive, organizados en una carpeta por cada promoción.
 *  - Permite volver a leer las fotos de una promoción (persisten
 *    aunque se recargue la página).
 *  - Permite listar qué promociones "personalizadas" ya creó la gente.
 *
 * CÓMO INSTALARLO
 *  1. Ve a https://script.google.com/ → Proyecto nuevo.
 *  2. Borra el contenido de Code.gs y pega TODO este archivo.
 *  3. Arriba a la derecha: Implementar > Nueva implementación.
 *       - Tipo: Aplicación web.
 *       - Descripción: Muro de Recuerdos.
 *       - Ejecutar como: Yo (tu cuenta de Google).
 *       - Quién tiene acceso: Cualquier usuario.
 *  4. Autoriza los permisos que te pida (acceso a tu Drive).
 *  5. Copia la URL que te entrega (".../exec") y pégala en script.js,
 *     en la constante DRIVE_WEBAPP_URL.
 *
 * NOTA: cada vez que cambies este código, tienes que crear una
 * "Nueva implementación" (o gestionar implementaciones > editar)
 * para que los cambios queden activos en la URL pública.
 */

const ROOT_FOLDER_NAME = 'Muro de Recuerdos - Ex Alumnos';

/** Devuelve (o crea) la carpeta raíz donde vive todo el muro. */
function getRootFolder_() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

/** Devuelve (o crea) la subcarpeta de una promoción específica. */
function getPromoFolder_(promoCode) {
  const root = getRootFolder_();
  const safeName = String(promoCode || 'General').replace(/[\\/:*?"<>|]/g, '-').trim() || 'General';
  const folders = root.getFoldersByName(safeName);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(safeName);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Subida de fotos/videos.
 * Espera un POST con body FormData (campos): promo, filename, mimeType, base64
 */
function doPost(e) {
  try {
    const promo = (e.parameter.promo || 'General').toString();
    const filename = (e.parameter.filename || ('archivo_' + new Date().getTime())).toString();
    const mimeType = (e.parameter.mimeType || 'image/jpeg').toString();
    const base64 = e.parameter.base64;

    if (!base64) {
      return jsonOut_({ ok: false, error: 'No se recibió archivo (base64 vacío).' });
    }

    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, mimeType, filename);

    const folder = getPromoFolder_(promo);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

    return jsonOut_({ ok: true, url: directUrl, id: fileId, promo: promo });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/**
 * Lectura de datos.
 *  - ?promo=CODE   -> { ok, promo, files:[{name,url,mimeType}] }
 *  - ?listAll=1    -> { ok, promos:[{code,label}] }  (todas las carpetas ya creadas)
 */
function doGet(e) {
  try {
    const params = e.parameter;

    if (params.listAll) {
      const root = getRootFolder_();
      const it = root.getFolders();
      const promos = [];
      while (it.hasNext()) {
        const f = it.next();
        promos.push({ code: f.getName(), label: 'Promo ' + f.getName() });
      }
      return jsonOut_({ ok: true, promos: promos });
    }

    const promo = params.promo;
    if (!promo) return jsonOut_({ ok: false, error: 'Falta el parámetro promo.' });

    const folder = getPromoFolder_(promo);
    const it = folder.getFiles();
    const files = [];
    while (it.hasNext()) {
      const f = it.next();
      files.push({
        name: f.getName(),
        mimeType: f.getMimeType(),
        url: 'https://drive.google.com/uc?export=view&id=' + f.getId()
      });
    }
    return jsonOut_({ ok: true, promo: promo, files: files });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}
