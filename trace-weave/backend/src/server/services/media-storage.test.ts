import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptMediaEnvelope,
  encryptMediaEnvelope,
  mediaStorage,
  MediaValidationError,
} from "./media-storage";
import { classifyClamAvResponse } from "./media-scanner";

describe("media storage validation", () => {
  it("accepts supported user-supplied attachment kinds", () => {
    expect(() => mediaStorage.assertMedia("voice", "audio/webm;codecs=opus", 512)).not.toThrow();
    expect(() => mediaStorage.assertMedia("image", "image/jpeg", 512)).not.toThrow();
    expect(() => mediaStorage.assertMedia("screenshot", "image/png", 512)).not.toThrow();
    expect(() => mediaStorage.assertMedia("video", "video/mp4", 512)).not.toThrow();
    expect(() => mediaStorage.assertMedia("file", "application/pdf", 512)).not.toThrow();
    expect(() => mediaStorage.assertMedia("file", "application/octet-stream", 512)).not.toThrow();
  });

  it("does not trust an image MIME type for a video attachment", () => {
    expect(() => mediaStorage.assertMedia("video", "image/png", 512)).toThrow(MediaValidationError);
  });

  it("rejects empty attachments", () => {
    expect(() => mediaStorage.assertMedia("image", "image/jpeg", 0)).toThrow("图片内容为空");
  });
});

describe("media envelope encryption", () => {
  it("round-trips bytes with a per-object wrapped data key", () => {
    const key = randomBytes(32);
    const storageKey = "user/entry/attachment.jpg";
    const plaintext = Buffer.from("private-life-attachment");
    const encrypted = encryptMediaEnvelope(plaintext, storageKey, key, "test-key-v1");
    expect(encrypted.equals(plaintext)).toBe(false);
    expect(decryptMediaEnvelope(encrypted, storageKey, key)).toEqual(plaintext);
  });

  it("rejects a different object key as authenticated context", () => {
    const key = randomBytes(32);
    const encrypted = encryptMediaEnvelope(Buffer.from("private"), "owner/a", key, "test-key-v1");
    expect(() => decryptMediaEnvelope(encrypted, "owner/b", key)).toThrow();
  });
});

describe("ClamAV result classification", () => {
  it("distinguishes clean, infected and invalid scanner responses", () => {
    expect(classifyClamAvResponse("stream: OK")).toBe("clean");
    expect(classifyClamAvResponse("stream: Eicar-Test-Signature FOUND")).toBe("infected");
    expect(classifyClamAvResponse("UNKNOWN COMMAND")).toBe("error");
  });
});
