import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { AnySubWallet } from '../../model/networks/base/subwallets/subwallet';
import { WalletUtil } from '../../model/wallet.util';
import { ContactsService, RecentRecipient } from '../../services/contacts.service';
import { WarningComponent } from '../warning/warning.component';

type CryptoAddressInfo = {
  cryptoname: string;
  type: string;
  address: string;
  resolver: string;
}

// SCR-029: colored initial-disc avatar palette (deterministic per name/address).
const AVATAR_COLORS = ['#ED6E2B', '#3A86FF', '#6DCD66', '#8E5BFF', '#FF5F8A', '#00B8A9'];

// SCR-029: number of characters kept at each end of a middle-ellipsis address.
const ADDR_HEAD_CHARS = 8;
const ADDR_TAIL_CHARS = 6;

// SCR-029: how long a press must be held to trigger the delete prompt (ms).
const LONG_PRESS_MS = 550;

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss'],
})
export class ContactsComponent implements OnInit {

  public supportedCryptoAddresses: CryptoAddressInfo[] = [];
  // SCR-006: recent recipients shown above the saved addresses.
  public recents: RecentRecipient[] = [];
  private subWallet: AnySubWallet = null;
  // SCR-029: pending long-press timer used to open the delete prompt.
  private longPressTimer: ReturnType<typeof setTimeout> = null;

  constructor(
    public contactsService: ContactsService,
    public theme: GlobalThemeService,
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private popoverCtrl: PopoverController,
    public translate: TranslateService
  ) {
    this.subWallet = this.navParams.get('subWallet');
  }

  ngOnInit() {
    void this.getContacts(this.subWallet)
    // SCR-006: surface recent recipients above the saved list.
    this.recents = this.contactsService.recents || [];
  }

  ionViewWillEnter() {
  }

  ionViewWillLeave() {
  }

  async getContacts(subWallet: AnySubWallet) {
    this.supportedCryptoAddresses = [];
    for (let index = 0; index < this.contactsService.contacts.length; index++) {
      let addresses = this.contactsService.contacts[index].addresses;
      for (let i = 0; i < addresses.length; i++) {
        let valid = await this.isAddressValid(subWallet, addresses[i].address);
        if (valid) {
          this.supportedCryptoAddresses.push({
            cryptoname: this.contactsService.contacts[index].cryptoname,
            type: addresses[i].type,
            address: addresses[i].address,
            resolver: this.contactsService.contacts[index].type
          })
        }
      }
    }
  }

  private async isAddressValid(subWallet: AnySubWallet, address: string) {
    if (subWallet) {
        return await subWallet.isAddressValid(address);
    } else {
        // Multi-sign wallet transfer to ESC or EID.
        return WalletUtil.isEVMAddress(address);
    }
}

  selectContact(contact: CryptoAddressInfo) {
    void this.modalCtrl.dismiss({
      contact: contact
    });
  }

  // SCR-006: pick a recent recipient; dismiss with a contact-shaped payload so
  // the consumer resolves it exactly like a saved address.
  selectRecent(recent: RecentRecipient) {
    void this.modalCtrl.dismiss({
      contact: {
        cryptoname: recent.address,
        type: '',
        address: recent.address,
        resolver: ''
      } as CryptoAddressInfo
    });
  }

  // SCR-029: first display character for the initial-disc avatar.
  getInitial(value: string): string {
    if (!value) {
      return '#';
    }
    let cleaned = value.startsWith('0x') ? value.slice(2) : value;
    return (cleaned.charAt(0) || '#').toUpperCase();
  }

  // SCR-029: deterministic avatar color derived from the label.
  getAvatarColor(value: string): string {
    let hash = 0;
    for (let i = 0; i < (value || '').length; i++) {
      hash = (hash + value.charCodeAt(i)) % AVATAR_COLORS.length;
    }
    return AVATAR_COLORS[hash];
  }

  // SCR-029: leading segment of a middle-ellipsis address.
  addrHead(address: string): string {
    if (!address) {
      return '';
    }
    return address.length > ADDR_HEAD_CHARS + ADDR_TAIL_CHARS ? address.slice(0, ADDR_HEAD_CHARS) : address;
  }

  // SCR-029: trailing segment (accent-tinted in the template).
  addrTail(address: string): string {
    if (!address || address.length <= ADDR_HEAD_CHARS + ADDR_TAIL_CHARS) {
      return '';
    }
    return address.slice(-ADDR_TAIL_CHARS);
  }

  // SCR-029: start the long-press timer that opens the delete prompt.
  handlePressStart(contact: CryptoAddressInfo) {
    this.clearLongPress();
    this.longPressTimer = setTimeout(() => {
      void this.showDeletePrompt(contact);
    }, LONG_PRESS_MS);
  }

  // SCR-029: cancel a long-press that ended before the threshold.
  handlePressEnd() {
    this.clearLongPress();
  }

  private clearLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  getResolverLogo(contact: CryptoAddressInfo) {
    let logo = '';
    switch (contact.resolver) {
        case 'ENS':
            logo = 'assets/wallet/logos/ENS.svg';
        break;
        case 'ELADomain':
            logo = 'assets/wallet/logos/eladomain.svg';
        break;
        case 'Idriss':
            logo = 'assets/wallet/logos/idriss.png';
        break;
        case 'UnstoppableDomains':
            logo = 'assets/wallet/logos/unstoppableDomains.png';
        break;
        default:
            logo = 'assets/wallet/logos/cryptoname.png';
        break;
    }
    return logo;
  }

  async showDeletePrompt(contact: CryptoAddressInfo) {

    let popover = await this.popoverCtrl.create({
        mode: 'ios',
        cssClass: 'wallet-warning-component',
        component: WarningComponent,
        componentProps: {
            title: this.translate.instant('wallet.delete-contact-confirm-title'),
            message: contact.cryptoname + " " + contact.type + " " + contact.resolver
        },
        translucent: false
    });

    popover.onWillDismiss().then(async (params) => {
        if (params && params.data && params.data.confirm) {
            await this.deleteContact(contact);
        }
    });

    return await popover.present();
  }

  deleteContact(contact: CryptoAddressInfo) {
    let contactIndex = this.contactsService.contacts.findIndex( c => {
        return (c.cryptoname === contact.cryptoname) && (c.type == contact.resolver);
    })
    if (contactIndex > -1) {
        let contactFind = this.contactsService.contacts[contactIndex];
        if (contactFind.addresses.length === 1) {
            this.contactsService.contacts.splice(contactIndex, 1);
        } else {
            let addressIndex = contactFind.addresses.findIndex( c => {
                return c.address === contact.address
            })
            if (addressIndex > -1) {
                contactFind.addresses.splice(addressIndex, 1);
            }
        }
    }

    contactIndex = this.supportedCryptoAddresses.findIndex( c => {
        return (c.cryptoname === contact.cryptoname) && (c.address === contact.address) && (c.resolver === contact.resolver);
    })
    if (contactIndex > -1) {
        this.supportedCryptoAddresses.splice(contactIndex, 1)
    }

    // save
    this.contactsService.setContacts()
  }
}
