BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 001_global_shipping

CREATE TABLE users (
    id VARCHAR(48) NOT NULL, 
    email VARCHAR(254) NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    password TEXT NOT NULL, 
    role VARCHAR(16) NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (email)
);

CREATE TABLE sessions (
    token_hash VARCHAR(64) NOT NULL, 
    user_id VARCHAR(48) NOT NULL, 
    expires VARCHAR(40) NOT NULL, 
    PRIMARY KEY (token_hash), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_sessions_expires ON sessions (expires);

CREATE TABLE shipments (
    id VARCHAR(40) NOT NULL, 
    tracking_token VARCHAR(64) NOT NULL, 
    created_by VARCHAR(48) NOT NULL, 
    recipient VARCHAR(120) NOT NULL, 
    recipient_email VARCHAR(254) NOT NULL, 
    origin VARCHAR(300) NOT NULL, 
    origin_country VARCHAR(80) NOT NULL, 
    destination VARCHAR(300) NOT NULL, 
    destination_country VARCHAR(80) NOT NULL, 
    weight FLOAT NOT NULL, 
    mode VARCHAR(16) NOT NULL, 
    source VARCHAR(16) NOT NULL, 
    carrier VARCHAR(80), 
    external_tracking VARCHAR(100), 
    status VARCHAR(32) NOT NULL, 
    estimated_delivery VARCHAR(10), 
    created_at VARCHAR(40) NOT NULL, 
    updated_at VARCHAR(40) NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (tracking_token), 
    FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE INDEX ix_shipments_status ON shipments (status);

CREATE TABLE events (
    id SERIAL NOT NULL, 
    shipment_id VARCHAR(40) NOT NULL, 
    status VARCHAR(32) NOT NULL, 
    location VARCHAR(160) NOT NULL, 
    public_note VARCHAR(500) NOT NULL, 
    actor_id VARCHAR(48) NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(shipment_id) REFERENCES shipments (id), 
    FOREIGN KEY(actor_id) REFERENCES users (id)
);

CREATE INDEX ix_events_shipment_id ON events (shipment_id);

CREATE TABLE audit_log (
    id SERIAL NOT NULL, 
    shipment_id VARCHAR(40) NOT NULL, 
    actor_id VARCHAR(48) NOT NULL, 
    action VARCHAR(32) NOT NULL, 
    changes TEXT NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(shipment_id) REFERENCES shipments (id), 
    FOREIGN KEY(actor_id) REFERENCES users (id)
);

CREATE INDEX ix_audit_log_shipment_id ON audit_log (shipment_id);

INSERT INTO alembic_version (version_num) VALUES ('001_global_shipping') RETURNING alembic_version.version_num;

-- Running upgrade 001_global_shipping -> 002_operations

CREATE TABLE bulk_operations (
    id VARCHAR(36) NOT NULL, 
    actor_id VARCHAR(48) NOT NULL, 
    body_hash VARCHAR(64) NOT NULL, 
    result TEXT, 
    created_at VARCHAR(40) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(actor_id) REFERENCES users (id)
);

CREATE INDEX ix_bulk_operations_created_at ON bulk_operations (created_at);

CREATE INDEX ix_ops_created_id ON shipments (created_at, id);

CREATE INDEX ix_ops_updated_id ON shipments (updated_at, id);

CREATE INDEX ix_ops_mode_status ON shipments (mode, status);

CREATE INDEX ix_ops_destination ON shipments (destination_country);

CREATE INDEX ix_ops_eta ON shipments (estimated_delivery);

UPDATE alembic_version SET version_num='002_operations' WHERE alembic_version.version_num = '001_global_shipping';

-- Running upgrade 002_operations -> 003_milestone_payments

CREATE TABLE payment_requests (
    id VARCHAR(48) NOT NULL, 
    shipment_id VARCHAR(40) NOT NULL, 
    created_by VARCHAR(48) NOT NULL, 
    title VARCHAR(120) NOT NULL, 
    amount NUMERIC(14, 2) NOT NULL, 
    currency VARCHAR(3) NOT NULL, 
    payee_name VARCHAR(160) NOT NULL, 
    bank_name VARCHAR(160) NOT NULL, 
    account_details VARCHAR(500) NOT NULL, 
    instructions TEXT NOT NULL, 
    blocks_progress BOOLEAN NOT NULL, 
    activate_at VARCHAR(32), 
    activated_at VARCHAR(40), 
    status VARCHAR(16) NOT NULL, 
    public_message VARCHAR(300) NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    updated_at VARCHAR(40) NOT NULL, 
    verified_at VARCHAR(40), 
    verified_by VARCHAR(48), 
    PRIMARY KEY (id), 
    CONSTRAINT ck_payment_amount_positive CHECK (amount > 0), 
    CONSTRAINT ck_payment_request_status CHECK (status IN ('requested','submitted','verified','cancelled')), 
    FOREIGN KEY(shipment_id) REFERENCES shipments (id), 
    FOREIGN KEY(created_by) REFERENCES users (id), 
    FOREIGN KEY(verified_by) REFERENCES users (id)
);

CREATE INDEX ix_payment_requests_shipment_id ON payment_requests (shipment_id);

CREATE INDEX ix_payment_gate ON payment_requests (shipment_id, status, activated_at, blocks_progress);

CREATE TABLE payment_submissions (
    id VARCHAR(48) NOT NULL, 
    payment_id VARCHAR(48) NOT NULL, 
    reference VARCHAR(120) NOT NULL, 
    note VARCHAR(300) NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    reviewed_at VARCHAR(40), 
    reviewed_by VARCHAR(48), 
    review_note VARCHAR(500) NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT ck_payment_submission_status CHECK (status IN ('submitted','verified','rejected','cancelled')), 
    FOREIGN KEY(payment_id) REFERENCES payment_requests (id), 
    FOREIGN KEY(reviewed_by) REFERENCES users (id)
);

CREATE INDEX ix_payment_submissions_payment_id ON payment_submissions (payment_id);

UPDATE alembic_version SET version_num='003_milestone_payments' WHERE alembic_version.version_num = '002_operations';

-- Running upgrade 003_milestone_payments -> 004_recorded_routes

ALTER TABLE events ADD COLUMN latitude FLOAT;

ALTER TABLE events ADD COLUMN longitude FLOAT;

UPDATE alembic_version SET version_num='004_recorded_routes' WHERE alembic_version.version_num = '003_milestone_payments';

-- Running upgrade 004_recorded_routes -> 005_public_map_pins

ALTER TABLE events ADD COLUMN map_public BOOLEAN DEFAULT false NOT NULL;

UPDATE alembic_version SET version_num='005_public_map_pins' WHERE alembic_version.version_num = '004_recorded_routes';

-- Running upgrade 005_public_map_pins -> 006_shipment_setup

ALTER TABLE shipments ADD COLUMN category VARCHAR(20) DEFAULT 'parcel' NOT NULL;

ALTER TABLE shipments ADD COLUMN contents_description TEXT DEFAULT '' NOT NULL;

ALTER TABLE shipments ADD COLUMN shipping_charge NUMERIC(14, 2);

ALTER TABLE shipments ADD COLUMN charge_currency VARCHAR(3) DEFAULT 'USD' NOT NULL;

ALTER TABLE shipments ADD COLUMN payment_method VARCHAR(24) DEFAULT 'not_set' NOT NULL;

ALTER TABLE shipments ADD COLUMN estimated_arrival_at VARCHAR(40);

ALTER TABLE shipments ADD COLUMN route_origin_label VARCHAR(160) DEFAULT '' NOT NULL;

ALTER TABLE shipments ADD COLUMN route_destination_label VARCHAR(160) DEFAULT '' NOT NULL;

ALTER TABLE shipments ADD COLUMN route_origin_lat FLOAT;

ALTER TABLE shipments ADD COLUMN route_origin_lon FLOAT;

ALTER TABLE shipments ADD COLUMN route_destination_lat FLOAT;

ALTER TABLE shipments ADD COLUMN route_destination_lon FLOAT;

ALTER TABLE shipments ADD COLUMN route_public BOOLEAN DEFAULT false NOT NULL;

CREATE TABLE shipment_photos (
    id VARCHAR(48) NOT NULL, 
    shipment_id VARCHAR(40) NOT NULL, 
    created_by VARCHAR(48) NOT NULL, 
    object_key VARCHAR(300) NOT NULL, 
    caption VARCHAR(160) NOT NULL, 
    public BOOLEAN DEFAULT false NOT NULL, 
    byte_size INTEGER NOT NULL, 
    width INTEGER NOT NULL, 
    height INTEGER NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    updated_at VARCHAR(40) NOT NULL, 
    deleted_at VARCHAR(40), 
    purged_at VARCHAR(40), 
    PRIMARY KEY (id), 
    FOREIGN KEY(shipment_id) REFERENCES shipments (id), 
    FOREIGN KEY(created_by) REFERENCES users (id), 
    UNIQUE (object_key)
);

CREATE INDEX ix_shipment_photos_shipment_id ON shipment_photos (shipment_id);

UPDATE alembic_version SET version_num='006_shipment_setup' WHERE alembic_version.version_num = '005_public_map_pins';

-- Running upgrade 006_shipment_setup -> 007_quote_requests

CREATE TABLE quote_requests (
    id VARCHAR(36) NOT NULL, 
    reference VARCHAR(24) NOT NULL, 
    payload_hash VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    email VARCHAR(254) NOT NULL, 
    phone VARCHAR(40) NOT NULL, 
    origin VARCHAR(160) NOT NULL, 
    destination VARCHAR(160) NOT NULL, 
    mode VARCHAR(16) NOT NULL, 
    category VARCHAR(20) NOT NULL, 
    weight NUMERIC(12, 3) NOT NULL, 
    notes TEXT NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    admin_note TEXT NOT NULL, 
    amount NUMERIC(14, 2), 
    currency VARCHAR(3) NOT NULL, 
    version INTEGER NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    updated_at VARCHAR(40) NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT ck_quote_status CHECK (status IN ('new','reviewing','quoted','closed')), 
    CONSTRAINT ck_quote_weight CHECK (weight > 0), 
    UNIQUE (reference)
);

CREATE INDEX ix_quote_requests_status ON quote_requests (status);

CREATE TABLE quote_activity (
    id VARCHAR(24) NOT NULL, 
    quote_id VARCHAR(36) NOT NULL, 
    actor_id VARCHAR(48), 
    status VARCHAR(16) NOT NULL, 
    note TEXT NOT NULL, 
    created_at VARCHAR(40) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(quote_id) REFERENCES quote_requests (id), 
    FOREIGN KEY(actor_id) REFERENCES users (id)
);

CREATE INDEX ix_quote_activity_quote_id ON quote_activity (quote_id);

CREATE TABLE quote_rate_limits (
    id VARCHAR(64) NOT NULL, 
    hits INTEGER NOT NULL, 
    expires INTEGER NOT NULL, 
    PRIMARY KEY (id)
);

UPDATE alembic_version SET version_num='007_quote_requests' WHERE alembic_version.version_num = '006_shipment_setup';

COMMIT;

