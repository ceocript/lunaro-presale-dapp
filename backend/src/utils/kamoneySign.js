// backend/src/utils/kamoneySign.js
import crypto from "crypto";

/**
 * Achata um objeto aninhado em um plano, igual ao exemplo PHP (querystring)
 * { user: { name: 'John' }, product: 'Laptop' }
 *  => { username: 'John', product: 'Laptop' }  (aqui vamos usar chave composta, tipo user[name], se precisar)
 * Para ficar simples e compatível com http_build_query, vamos usar chaves "normais".
 */
function flattenObject(obj, prefix = "") {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, `${newKey}`));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Gera assinatura HMAC SHA512 no mesmo esquema da doc da Kamoney
 * - reqObj: objeto original que será enviado no body
 * - secret: chave secreta
 */
export function generateKamoneySignature(reqObj, secret) {
  const flat = flattenObject(reqObj);
  const queryString = new URLSearchParams(flat).toString();  
  // Ex.: name=John+Doe&email=john@example.com&product=Laptop

  const signature = crypto
    .createHmac("sha512", secret)
    .update(queryString)
    .digest("hex");

  return { signature, queryString };
}
