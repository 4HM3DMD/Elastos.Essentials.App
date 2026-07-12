import { Injectable } from '@angular/core';
import Queue from 'promise-queue';

declare let passwordManager: PasswordManagerPlugin.PasswordManager;

/**
 * Wrapper on top of the password manager plugin to queue requests and avoid multiple requests to the password manager
 * at the same time.
 */
@Injectable({
  providedIn: 'root'
})
export class GlobalPasswordService {
  private queue = new Queue(1);

  constructor(
  ) { }

  public getPasswordInfo(key: string, options?: PasswordManagerPlugin.GetPasswordInfoOptions): Promise<PasswordManagerPlugin.PasswordInfo> {
    return this.queue.add(() => passwordManager.getPasswordInfo(key, options));
  }

  public deletePasswordInfo(key: string): Promise<PasswordManagerPlugin.BooleanWithReason> {
    return this.queue.add(() => passwordManager.deletePasswordInfo(key));
  }

  public generateRandomPassword(options?: PasswordManagerPlugin.PasswordCreationOptions): Promise<string> {
    return passwordManager.generateRandomPassword();
  }

  public setPasswordInfo(info: PasswordManagerPlugin.PasswordInfo): Promise<PasswordManagerPlugin.BooleanWithReason> {
    return this.queue.add(() => passwordManager.setPasswordInfo(info));
  }

  public changeMasterPassword(): Promise<PasswordManagerPlugin.BooleanWithReason> {
    return this.queue.add(() => passwordManager.changeMasterPassword());
  }

  /**
   * Re-locks the password database. The next access to a stored password will require the
   * user to provide the master password again. Used by the auto-lock (GlobalSecurityService).
   * Routed through the same queue as the other calls so it cannot race an in-flight unlock.
   */
  public lockMasterPassword(): Promise<void> {
    return this.queue.add(() => Promise.resolve(passwordManager.lockMasterPassword()));
  }
}
