import { h, Component } from 'preact';
import { log } from '../utils';
import { trackEvent } from '../analytics';
import { itemService } from '../itemService';
import { alertsService } from '../notifications';
import { deferred } from '../deferred';
import { ItemTile } from './ItemTile';

export default class SavedItemPane extends Component {
	constructor(props) {
		super(props);
		// this.items = [];
	}

	static getDerivedStateFromProps({ items = {} }, state) {
		const newItems = Object.values(items);
		newItems.sort(function(a, b) {
			return b.updatedOn - a.updatedOn;
		});
		return {
			items: newItems
		};
	}
	shouldComponentUpdate(nextProps, nextState) {
		return (
			nextProps.items !== this.props.items ||
			nextProps.isOpen !== this.props.isOpen ||
			nextState.filteredItems !== this.state.filteredItems
		);
	}

	componentDidUpdate(prevProps) {
		// Opening
		if (this.props.isOpen && !prevProps.isOpen) {
			window.searchInput.value = '';
			window.searchInput.focus();
		}
		// Closing
		if (!this.props.isOpen && prevProps.isOpen) {
			this.setState({
				filteredItems: undefined
			});
		}
	}
	onCloseIntent() {
		this.props.closeHandler();
	}
	itemClickHandler(item) {
		this.props.itemClickHandler(item);
	}
	itemRemoveBtnClickHandler(item, e) {
		e.stopPropagation();
		this.props.itemRemoveBtnClickHandler(item);
	}
	itemForkBtnClickHandler(item, e) {
		e.stopPropagation();
		this.props.itemForkBtnClickHandler(item);
	}
	keyDownHandler(event) {
		if (!this.props.isOpen) {
			return;
		}

		const isCtrlOrMetaPressed = event.ctrlKey || event.metaKey;
		const isForkKeyPressed = isCtrlOrMetaPressed && event.keyCode === 70;
		const isDownKeyPressed = event.keyCode === 40;
		const isUpKeyPressed = event.keyCode === 38;
		const isEnterKeyPressed = event.keyCode === 13;

		const selectedItemElement = $('.js-saved-item-tile.selected');
		const havePaneItems = $all('.js-saved-item-tile').length !== 0;

		if ((isDownKeyPressed || isUpKeyPressed) && havePaneItems) {
			const method = isDownKeyPressed ? 'nextUntil' : 'previousUntil';

			if (selectedItemElement) {
				selectedItemElement.classList.remove('selected');
				selectedItemElement[method](
					'.js-saved-item-tile:not(.hide)'
				).classList.add('selected');
			} else {
				$('.js-saved-item-tile:not(.hide)').classList.add('selected');
			}
			$('.js-saved-item-tile.selected').scrollIntoView(false);
		}

		if (isEnterKeyPressed && selectedItemElement) {
			const item = this.props.items[selectedItemElement.dataset.itemId];
			console.log('opening', item);
			this.props.itemClickHandler(item);
			trackEvent('ui', 'openItemKeyboardShortcut');
		}

		// Fork shortcut inside saved creations panel with Ctrl/⌘ + F
		if (isForkKeyPressed) {
			event.preventDefault();
			const item = this.props.items[selectedItemElement.dataset.itemId];
			this.props.itemForkBtnClickHandler(item);
			trackEvent('ui', 'forkKeyboardShortcut');
		}
	}

	importFileChangeHandler(e) {
		var file = e.target.files[0];

		var reader = new FileReader();
		reader.addEventListener('load', progressEvent => {
			var items;
			try {
				items = JSON.parse(progressEvent.target.result);
				log(items);
				this.props.mergeImportedItems(items);
			} catch (exception) {
				log(exception);
				alert(
					'Oops! Selected file is corrupted. Please select a file that was generated by clicking the "Export" button.'
				);
			}
		});

		reader.readAsText(file, 'utf-8');
	}

	importBtnClickHandler(e) {
		var input = document.createElement('input');
		input.type = 'file';
		input.style.display = 'none';
		input.accept = 'accept="application/json';
		document.body.appendChild(input);
		input.addEventListener('change', this.importFileChangeHandler.bind(this));
		input.click();
		trackEvent('ui', 'importBtnClicked');
		e.preventDefault();
	}

	searchInputHandler(e) {
		const text = e.target.value.toLowerCase();
		if (!text) {
			this.setState({
				filteredItems: this.state.items
			});
		} else {
			this.setState({
				filteredItems: this.state.items.filter(
					item => item.title.toLowerCase().indexOf(text) !== -1
				)
			});
		}
		trackEvent('ui', 'searchInputType');
	}

	render(
		{ isOpen, exportBtnClickHandler },
		{ filteredItems = this.state.items, items = [] }
	) {
		return (
			<div
				id="js-saved-items-pane"
				class={`saved-items-pane ${isOpen ? 'is-open' : ''}`}
				onKeyDown={this.keyDownHandler.bind(this)}
				aria-hidden={isOpen}
			>
				<button
					onClick={this.onCloseIntent.bind(this)}
					class="btn  saved-items-pane__close-btn"
					id="js-saved-items-pane-close-btn"
					aria-label="Close saved creations pane"
				>
					X
				</button>
				<div class="flex flex-v-center" style="justify-content: space-between;">
					<h3>My Library ({filteredItems.length})</h3>

					<div>
						<button
							onClick={exportBtnClickHandler}
							class="btn--dark hint--bottom-left hint--rounded hint--medium"
							aria-label="Export all your creations into a single importable file."
						>
							Export
						</button>
						<button
							onClick={this.importBtnClickHandler.bind(this)}
							class="btn--dark hint--bottom-left hint--rounded hint--medium"
							aria-label="Import your creations. Only the file that you export through the 'Export' button can be imported."
						>
							Import
						</button>
					</div>
				</div>
				<input
					autocomplete="off"
					type="search"
					id="searchInput"
					class="search-input"
					onInput={this.searchInputHandler.bind(this)}
					placeholder="Search your creations here..."
				/>

				<div id="js-saved-items-wrap" class="saved-items-pane__container">
					{!filteredItems.length && items.length ? (
						<div class="mt-1">No match found.</div>
					) : null}
					{filteredItems.map(item => (
						<ItemTile
							item={item}
							onClick={this.itemClickHandler.bind(this, item)}
							onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
							onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
						/>
					))}
					{!items.length ? (
						<div class="tac">
							<h2 class="opacity--30">Nothing saved here.</h2>
							<img style="max-width: 80%; opacity:0.4" src="assets/empty.svg" />
						</div>
					) : null}
				</div>
			</div>
		);
	}
}