import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';

import { ApiService } from '../../shared/services/api.service';
import { GlobalService } from '../../shared/services/global.service';
import { ModalService } from '../../shared/services/modal.service';
import { WalletInfo } from '../../shared/classes/wallet-info';
import { TransactionInfo } from '../../shared/classes/transaction-info';

import { SendComponent } from '../send/send.component';
import { ReceiveComponent } from '../receive/receive.component';
import { TransactionDetailsComponent } from '../transaction-details/transaction-details.component';

import { Subscription } from 'rxjs/Subscription';
import { Router } from '@angular/router';
import { DepositComponent } from '../sidechains/deposit/deposit.component';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'dashboard-component',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements OnInit, OnDestroy {
  public walletName: string;
  public coinUnit: string;
  public confirmedBalance: number;
  public unconfirmedBalance: number;
  public transactionArray: TransactionInfo[];
  public stakingForm: FormGroup;
  private walletBalanceSubscription: Subscription;
  private walletHistorySubscription: Subscription;
  private stakingInfoSubscription: Subscription;
  public stakingEnabled: boolean;
  public stakingActive: boolean;
  public stakingWeight: number;
  public netStakingWeight: number;
  public expectedTime: number;
  public dateTime: string;
  public isStarting: boolean;
  public isStopping: boolean;
  public hasBalance = false;

  constructor(
    private apiService: ApiService,
    private globalService: GlobalService,
    private modalService: NgbModal,
    private genericModalService: ModalService,
    private router: Router,
    private fb: FormBuilder) {
    this.buildStakingForm();
  }

  ngOnInit() {
    this.startSubscriptions();
    this.walletName = this.globalService.WalletName;
    this.coinUnit = this.globalService.CoinUnit;
  }

  ngOnDestroy() {
    this.cancelSubscriptions();
  }

  private buildStakingForm(): void {
    this.stakingForm = this.fb.group({
      'walletPassword': ['', Validators.required]
    });
  }

  public goToHistory() {
    this.router.navigate(['/wallet/history']);
  }

  public openSendDialog() {
    const modalRef = this.modalService.open(
        SendComponent,
        { backdrop: 'static', keyboard: false, windowClass: 'test-class' });
  }

  public openSidechainTransferDialog() {
    const modalRef = this.modalService.open(
        DepositComponent,
        { backdrop: 'static', keyboard: false }
    );
  }

  public openReceiveDialog() {
    const modalRef = this.modalService.open(ReceiveComponent, { backdrop: 'static', keyboard: false });
  }

  public openTransactionDetailDialog(transaction: TransactionInfo) {
    const modalRef = this.modalService.open(TransactionDetailsComponent, { backdrop: 'static', keyboard: false });
    modalRef.componentInstance.transaction = transaction;
  }

  private getWalletBalance() {
    const walletInfo = new WalletInfo(this.globalService.WalletName);
    this.walletBalanceSubscription = this.apiService.getWalletBalance(walletInfo)
      .subscribe(
        response =>  {
          if (response.status >= 200 && response.status < 400) {
              const balanceResponse = response.json();
              // TODO - add account feature instead of using first entry in array
              this.confirmedBalance = balanceResponse.balances[0].amountConfirmed;
              this.unconfirmedBalance = balanceResponse.balances[0].amountUnconfirmed;
              if ((this.confirmedBalance + this.unconfirmedBalance) > 0) {
                this.hasBalance = true;
              } else {
                this.hasBalance = false;
              }
          }
        },
        error => {
          console.log(error);
          if (error.status === 0) {
            this.cancelSubscriptions();
            this.genericModalService.openModal(null, null);
          } else if (error.status >= 400) {
            if (!error.json().errors[0]) {
              console.log(error);
            } else {
              if (error.json().errors[0].description) {
                this.genericModalService.openModal(null, error.json().errors[0].message);
              } else {
                this.cancelSubscriptions();
                this.startSubscriptions();
              }
            }
          }
        }
      );
  }

  // todo: add history in seperate service to make it reusable
  private getHistory() {
    const walletInfo = new WalletInfo(this.globalService.WalletName);
    let historyResponse;
    this.walletHistorySubscription = this.apiService.getWalletHistory(walletInfo)
      .subscribe(
        response => {
          if (response.status >= 200 && response.status < 400) {
            // TODO - add account feature instead of using first entry in array
            if (response.json().history[0].transactionsHistory.length > 0) {
              historyResponse = response.json().history[0].transactionsHistory;
              this.getTransactionInfo(historyResponse);
            }
          }
        },
        error => {
          console.log(error);
          if (error.status === 0) {
            this.cancelSubscriptions();
            this.genericModalService.openModal(null, null);
          } else if (error.status >= 400) {
            if (!error.json().errors[0]) {
              console.log(error);
            } else {
              if (error.json().errors[0].description) {
                this.genericModalService.openModal(null, error.json().errors[0].message);
              } else {
                this.cancelSubscriptions();
                this.startSubscriptions();
              }
            }
          }
        }
      );
  }

  private getTransactionInfo(transactions: any) {
    this.transactionArray = [];

    for (const transaction of transactions) {
      let transactionType;
      if (transaction.type === 'send') {
        transactionType = 'sent';
      } else if (transaction.type === 'received') {
        transactionType = 'received';
      } else if (transaction.type === 'staked') {
        transactionType = 'staked';
      }
      const transactionId = transaction.id;
      const transactionAmount = transaction.amount;
      let transactionFee;
      if (transaction.fee) {
        transactionFee = transaction.fee;
      } else {
        transactionFee = 0;
      }
      const transactionConfirmedInBlock = transaction.confirmedInBlock;
      const transactionTimestamp = transaction.timestamp;

      this.transactionArray.push(
        new TransactionInfo(
          transactionType,
          transactionId,
          transactionAmount,
          transactionFee,
          transactionConfirmedInBlock,
          transactionTimestamp));
    }
  }

  private startStaking() {
    this.isStarting = true;
    this.isStopping = false;
    const walletData = {
      name: this.globalService.WalletName,
      password: this.stakingForm.get('walletPassword').value
    };
    this.apiService.startStaking(walletData)
      .subscribe(
        response =>  {
          if (response.status >= 200 && response.status < 400) {
            this.stakingEnabled = true;
            this.stakingForm.patchValue({ walletPassword: '' });
          }
        },
        error => {
          this.isStarting = false;
          this.stakingEnabled = false;
          this.stakingForm.patchValue({ walletPassword: '' });
          if (error.status === 0) {
            this.genericModalService.openModal(null, null);
          } else if (error.status >= 400) {
            if (!error.json().errors[0]) {
              console.log(error);
            } else {
              this.genericModalService.openModal(null, error.json().errors[0].message);
            }
          }
        }
      )
    ;
  }

  private stopStaking() {
    this.isStopping = true;
    this.isStarting = false;
    this.apiService.stopStaking()
      .subscribe(
        response =>  {
          if (response.status >= 200 && response.status < 400) {
            this.stakingEnabled = false;
          }
        },
        error => {
          if (error.status === 0) {
            this.genericModalService.openModal(null, null);
          } else if (error.status >= 400) {
            if (!error.json().errors[0]) {
              console.log(error);
            } else {
              this.genericModalService.openModal(null, error.json().errors[0].message);
            }
          }
        }
      )
    ;
  }

  private getStakingInfo() {
    this.stakingInfoSubscription = this.apiService.getStakingInfo()
      .subscribe(
        response =>  {
          if (response.status >= 200 && response.status < 400) {
            const stakingResponse = response.json();
            this.stakingEnabled = stakingResponse.enabled;
            this.stakingActive = stakingResponse.staking;
            this.stakingWeight = stakingResponse.weight;
            this.netStakingWeight = stakingResponse.netStakeWeight;
            this.expectedTime = stakingResponse.expectedTime;
            this.dateTime = this.secondsToString(this.expectedTime);
            if (this.stakingActive) {
              this.isStarting = false;
            } else {
              this.isStopping = false;
            }
          }
        },
        error => {
          if (error.status === 0) {
            this.genericModalService.openModal(null, null);
          } else if (error.status >= 400) {
            if (!error.json().errors[0]) {
              console.log(error);
            } else {
              this.genericModalService.openModal(null, error.json().errors[0].message);
            }
          }
        }
      )
    ;
  }

  private secondsToString(seconds: number) {
    const numDays = Math.floor(seconds / 86400);
    const numHours = Math.floor((seconds % 86400) / 3600);
    const numMinutes = Math.floor(((seconds % 86400) % 3600) / 60);
    const numSeconds = ((seconds % 86400) % 3600) % 60;
    let dateString = '';

    if (numDays > 0) {
      if (numDays > 1) {
        dateString += numDays + ' days ';
      } else {
        dateString += numDays + ' day ';
      }
    }

    if (numHours > 0) {
      if (numHours > 1) {
        dateString += numHours + ' hours ';
      } else {
        dateString += numHours + ' hour ';
      }
    }

    if (numMinutes > 0) {
      if (numMinutes > 1) {
        dateString += numMinutes + ' minutes ';
      } else {
        dateString += numMinutes + ' minute ';
      }
    }

    if (dateString === '') {
      dateString = 'Unknown';
    }

    return dateString;
  }

  private cancelSubscriptions() {
    if (this.walletBalanceSubscription) {
      this.walletBalanceSubscription.unsubscribe();
    }

    if (this.walletHistorySubscription) {
      this.walletHistorySubscription.unsubscribe();
    }

    if (this.stakingInfoSubscription) {
      this.stakingInfoSubscription.unsubscribe();
    }
  }

  private startSubscriptions() {
    this.getWalletBalance();
    this.getHistory();
    this.getStakingInfo();
  }
}
