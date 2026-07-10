import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Logger } from 'src/app/logger';
import * as CryptoAddressResolvers from '../model/address-resolvers';
import { NameResolvingService } from './nameresolving.service';
import { LocalStorage } from './storage.service';

export type Contact = {
  cryptoname: string;
  type: string;
  addresses: CryptoAddress[];
  address?: string; // Version < 2.6.0
};

export type CryptoAddress = {
  type: string;
  address: string;
}

// SCR-006: a recent recipient recorded after a successful send, surfaced in a
// "Recents" section of the saved-addresses sheet.
export type RecentRecipient = {
  address: string;
  amount: string;
  symbol: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})

export class ContactsService {

  // SCR-006: persistence key and cap for the recents store.
  private static readonly RECENTS_KEY = 'recent-recipients';
  private static readonly MAX_RECENTS = 5;

  public contacts: Contact[] = [];
  public recents: RecentRecipient[] = [];

  constructor(
    private storage: LocalStorage,
    private http: HttpClient
  ) { }

  async init() {
    await this.getContacts();
    await this.getRecents();
  }

  // SCR-006: load the persisted recent recipients (newest first).
  async getRecents(): Promise<RecentRecipient[]> {
    let raw = await this.storage.get(ContactsService.RECENTS_KEY);
    this.recents = Array.isArray(raw) ? raw : [];
    return this.recents;
  }

  // SCR-006: record a recipient after a successful send. De-dupes by address
  // (case-insensitive: the same EVM address can arrive in different checksum
  // casing), keeps the newest first and caps the stored list.
  async addRecent(recent: RecentRecipient): Promise<void> {
    this.recents = this.recents.filter((r) => r.address.toLowerCase() !== recent.address.toLowerCase());
    this.recents.unshift(recent);
    if (this.recents.length > ContactsService.MAX_RECENTS) {
      this.recents = this.recents.slice(0, ContactsService.MAX_RECENTS);
    }
    await this.storage.set(ContactsService.RECENTS_KEY, JSON.stringify(this.recents));
  }

  setContacts(): Promise<void> {
    return this.storage.setContacts(this.contacts);
  }

  getContacts() {
    return new Promise<void>((resolve, reject) => {
      void this.storage.getContacts().then(async (contacts) => {
        Logger.log('wallet', "Fetched stored contacts", contacts);
        if (contacts) {
          await this.updateContacts(contacts);
        }
        resolve();
      });
    });
  }

  async updateContacts(contacts: Contact[]) {
    this.contacts = contacts;
    let needUpdate = false;
    let cryptoNameResolver = NameResolvingService.instance.getResolverByName('CryptoName');
    let idrissAddressResolver = NameResolvingService.instance.getResolverByName('Idriss');
    let usDomainResolver = NameResolvingService.instance.getResolverByName('Unstoppable Domains');
    let ELADomainResolver = NameResolvingService.instance.getResolverByName('ELADomain');
    for (let index = 0; index < contacts.length; index++) {
      let contact = contacts[index];
      if (contact.cryptoname.startsWith('CryptoName: ')) {
        contact.cryptoname = contact.cryptoname.replace('CryptoName: ', '')
        needUpdate = true;
      }

      // The data is {cryptoname:"", address:"xxx"} in version < 2.6.0, only for type CryptoName.
      if (!contact.type && contact.address) {
        contact.type = 'CryptoName';
        contact.addresses = [{
          type: 'ela.address',
          address: contact.address
        }]

        delete(contact.address);
      }

      let results: CryptoAddressResolvers.Address[] = null;
      switch (contact.type) {
        case 'CryptoName':
          results = await cryptoNameResolver.resolve(contact.cryptoname, null);
        break;
        case 'Idriss':
          results = await idrissAddressResolver.resolve(contact.cryptoname, null);
        break;
        case 'Unstoppable Domains':
          results = await usDomainResolver.resolve(contact.cryptoname, null);
        break;
        case 'ELADomain':
            results = await ELADomainResolver.resolve(contact.cryptoname, null);
        break;
        default:
        break;
      }

      if (results && results.length > 0) {
        for (let i = 0; i < results.length; i++) {
          const addressFind = contact.addresses.find((ad) => ad.type === results[i].addressType);
          if (!addressFind) {
            contact.addresses.push({type: results[i].addressType, address: results[i].address})
            needUpdate = true;
          } else {
            // update
            if (addressFind.address != results[i].address) {
              addressFind.address = results[i].address;
              needUpdate = true;
            }
          }
        }
      } else {
        // Maybe we should not remove the contact if it is due to network problems.
        // this.contacts.splice(index, 1);
      }
    }

    if (needUpdate) {
      void this.storage.setContacts(this.contacts);
    }
  }

  async addContact(address: CryptoAddressResolvers.CryptoNameAddress) {
    let needUpdate = false;
    const targetContact = this.contacts.find((contact) => (contact.cryptoname === address.name) && (contact.type === address.type));
    if (!targetContact) {
        this.contacts.push({
            cryptoname: address.name,
            type: address.type,
            addresses: [{type: address.addressType, address: address.address}]
        });

        needUpdate = true;
    } else {
      if (targetContact.addresses) {
        const addressFind = targetContact.addresses.find((ad) => ad.address === address.address);
        if (!addressFind) {
          targetContact.addresses.push({type: address.addressType, address: address.address})
          needUpdate = true;
        }
      } else {
        targetContact.addresses = [{type: address.addressType, address: address.address}];
        needUpdate = true;
      }
    }

    if (needUpdate) {
      await this.setContacts();
    }
  }
}
