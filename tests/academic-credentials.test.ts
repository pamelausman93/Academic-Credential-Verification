import { describe, it, expect, beforeEach } from 'vitest';

// Mock Clarity contract state
let credentials = new Map();
let institutions = new Map();
let selectiveDisclosure = new Map();
let lastCredentialId = 0;

// Mock Clarity functions
function registerInstitution(caller: string, institution: string): { type: string; value: boolean } {
  if (caller !== 'contract-owner') {
    return { type: 'err', value: false };
  }
  institutions.set(institution, true);
  return { type: 'ok', value: true };
}

function issueCredential(caller: string, recipient: string, credentialHash: string): { type: string; value: number } {
  if (!institutions.get(caller)) {
    return { type: 'err', value: 103 };
  }
  const newId = ++lastCredentialId;
  credentials.set(newId, {
    institution: caller,
    recipient,
    credentialHash,
    issuanceDate: Date.now(),
    isRevoked: false,
  });
  return { type: 'ok', value: newId };
}

function revokeCredential(caller: string, credentialId: number): { type: string; value: boolean } {
  const credential = credentials.get(credentialId);
  if (!credential) {
    return { type: 'err', value: 101 };
  }
  if (credential.institution !== caller) {
    return { type: 'err', value: 103 };
  }
  credential.isRevoked = true;
  credentials.set(credentialId, credential);
  return { type: 'ok', value: true };
}

function addSelectiveDisclosure(caller: string, credentialId: number, field: string, value: string): { type: string; value: boolean } {
  const credential = credentials.get(credentialId);
  if (!credential) {
    return { type: 'err', value: 101 };
  }
  if (credential.recipient !== caller) {
    return { type: 'err', value: 103 };
  }
  selectiveDisclosure.set(`${credentialId}-${field}`, value);
  return { type: 'ok', value: true };
}

function verifyCredential(credentialId: number, credentialHash: string): { type: string; value: boolean } {
  const credential = credentials.get(credentialId);
  if (!credential) {
    return { type: 'err', value: 101 };
  }
  return { type: 'ok', value: credential.credentialHash === credentialHash && !credential.isRevoked };
}

function getCredentialInfo(credentialId: number): any {
  return credentials.get(credentialId);
}

function getSelectiveDisclosure(credentialId: number, field: string): string | undefined {
  return selectiveDisclosure.get(`${credentialId}-${field}`);
}

describe('Academic Credential Verification System', () => {
  beforeEach(() => {
    credentials.clear();
    institutions.clear();
    selectiveDisclosure.clear();
    lastCredentialId = 0;
  });
  
  it('should register an institution', () => {
    const result = registerInstitution('contract-owner', 'university1');
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    expect(institutions.get('university1')).toBe(true);
  });
  
  it('should not allow non-owners to register institutions', () => {
    const result = registerInstitution('non-owner', 'university2');
    expect(result.type).toBe('err');
    expect(institutions.get('university2')).toBeUndefined();
  });
  
  it('should issue a credential', () => {
    registerInstitution('contract-owner', 'university1');
    const result = issueCredential('university1', 'student1', 'hash123');
    expect(result.type).toBe('ok');
    expect(result.value).toBe(1);
    const credential = credentials.get(1);
    expect(credential).toBeDefined();
    expect(credential.recipient).toBe('student1');
    expect(credential.credentialHash).toBe('hash123');
  });
  
  it('should not allow unregistered institutions to issue credentials', () => {
    const result = issueCredential('unregistered-university', 'student1', 'hash123');
    expect(result.type).toBe('err');
    expect(result.value).toBe(103);
  });
  
  it('should revoke a credential', () => {
    registerInstitution('contract-owner', 'university1');
    issueCredential('university1', 'student1', 'hash123');
    const result = revokeCredential('university1', 1);
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    const credential = credentials.get(1);
    expect(credential.isRevoked).toBe(true);
  });
  
  it('should not allow unauthorized revocation', () => {
    registerInstitution('contract-owner', 'university1');
    issueCredential('university1', 'student1', 'hash123');
    const result = revokeCredential('university2', 1);
    expect(result.type).toBe('err');
    expect(result.value).toBe(103);
  });
  
  it('should add selective disclosure', () => {
    registerInstitution('contract-owner', 'university1');
    issueCredential('university1', 'student1', 'hash123');
    const result = addSelectiveDisclosure('student1', 1, 'gpa', '3.8');
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    expect(getSelectiveDisclosure(1, 'gpa')).toBe('3.8');
  });
  
  it('should not allow unauthorized selective disclosure', () => {
    registerInstitution('contract-owner', 'university1');
    issueCredential('university1', 'student1', 'hash123');
    const result = addSelectiveDisclosure('student2', 1, 'gpa', '3.8');
    expect(result.type).toBe('err');
    expect(result.value).toBe(103);
  });
  
  it('should verify a valid credential', () => {
    registerInstitution('contract-owner', 'university1');
    issueCredential('university1', 'student1', 'hash123');
    const result = verifyCredential(1, 'hash123');
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
  });
  
  it('should not verify a revoked credential', () => {
    registerInstitution('contract-owner', 'university1');
    issueCredential('university1', 'student1', 'hash123');
    revokeCredential('university1', 1);
    const result = verifyCredential(1, 'hash123');
    expect(result.type).toBe('ok');
    expect(result.value).toBe(false);
  });
});

