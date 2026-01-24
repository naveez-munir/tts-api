# Customer Management Endpoints - Testing Guide

## Overview
This document provides testing instructions for the newly implemented admin customer management endpoints.

---

## 🔐 Prerequisites
- Admin JWT token (login as admin user)
- Set `Authorization: Bearer <admin_token>` header for all requests

---

## 📋 Endpoints to Test

### 1. List All Customers
**Endpoint:** `GET /api/admin/customers`

**Query Parameters:**
- `search` (optional) - Search by email, firstName, lastName
- `isActive` (optional) - Filter by status: 'true' or 'false'
- `sortBy` (optional) - Sort field: 'createdAt', 'lastName', 'email' (default: 'createdAt')
- `sortOrder` (optional) - Sort order: 'asc' or 'desc' (default: 'desc')
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20, max: 100)

**Example Requests:**
```bash
# List all customers (default pagination)
GET /api/admin/customers

# Search for customers by email
GET /api/admin/customers?search=john@example.com

# Filter active customers only
GET /api/admin/customers?isActive=true

# Sort by last name ascending
GET /api/admin/customers?sortBy=lastName&sortOrder=asc

# Paginated results
GET /api/admin/customers?page=2&limit=10
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "customer_id",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phoneNumber": "+447123456789",
        "isActive": true,
        "isEmailVerified": true,
        "totalBookings": 5,
        "totalSpent": 250.00,
        "registeredAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### 2. View Individual Customer Details
**Endpoint:** `GET /api/admin/customers/:id`

**Example Request:**
```bash
GET /api/admin/customers/clx123abc456
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "clx123abc456",
      "email": "customer@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+447123456789",
      "isActive": true,
      "isEmailVerified": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-20T14:22:00.000Z"
    },
    "statistics": {
      "totalBookings": 5,
      "completedBookings": 3,
      "cancelledBookings": 1,
      "activeBookings": 1,
      "totalSpent": 250.00
    },
    "recentBookings": [
      {
        "id": "booking_id",
        "bookingReference": "TTS-ABC123",
        "status": "COMPLETED",
        "pickupAddress": "Heathrow Airport Terminal 5",
        "dropoffAddress": "123 Main St, London",
        "pickupDatetime": "2024-01-20T08:00:00.000Z",
        "customerPrice": 50.00,
        "vehicleType": "SALOON",
        "journeyType": "ONE_WAY",
        "createdAt": "2024-01-18T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 3. Update Customer Account Status
**Endpoint:** `PATCH /api/admin/customers/:id/status`

**Request Body:**
```json
{
  "isActive": false
}
```

**Example Requests:**
```bash
# Deactivate customer account
PATCH /api/admin/customers/clx123abc456/status
Body: { "isActive": false }

# Activate customer account
PATCH /api/admin/customers/clx123abc456/status
Body: { "isActive": true }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx123abc456",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": false,
    "updatedAt": "2024-01-22T15:30:00.000Z",
    "message": "Customer account deactivated"
  }
}
```

---

### 4. Customer Booking History
**Endpoint:** `GET /api/admin/customers/:id/bookings`

**Query Parameters:** (same as admin bookings endpoint)
- `status` (optional) - Filter by booking status
- `dateFrom` (optional) - Filter from date (ISO 8601)
- `dateTo` (optional) - Filter to date (ISO 8601)
- `search` (optional) - Search booking reference, addresses
- `page` (optional) - Page number
- `limit` (optional) - Items per page

**Example Request:**
```bash
GET /api/admin/customers/clx123abc456/bookings?status=COMPLETED&page=1&limit=10
```

**Expected Response:** (same format as admin bookings list)

---

### 5. Customer Transaction History
**Endpoint:** `GET /api/admin/customers/:id/transactions`

**Query Parameters:**
- `transactionType` (optional) - 'CUSTOMER_PAYMENT', 'REFUND', 'PLATFORM_COMMISSION', 'OPERATOR_PAYOUT'
- `status` (optional) - 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'
- `dateFrom` (optional) - Filter from date
- `dateTo` (optional) - Filter to date
- `page` (optional) - Page number
- `limit` (optional) - Items per page

**Example Request:**
```bash
GET /api/admin/customers/clx123abc456/transactions?transactionType=CUSTOMER_PAYMENT&status=COMPLETED
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_id",
        "transactionType": "CUSTOMER_PAYMENT",
        "amount": 50.00,
        "currency": "GBP",
        "status": "COMPLETED",
        "description": null,
        "stripeTransactionId": "pi_123abc",
        "booking": {
          "bookingReference": "TTS-ABC123",
          "pickupAddress": "Heathrow Airport",
          "dropoffAddress": "London",
          "vehicleType": "SALOON"
        },
        "createdAt": "2024-01-20T08:00:00.000Z",
        "completedAt": "2024-01-20T08:01:00.000Z"
      }
    ],
    "summary": {
      "totalAmount": 250.00,
      "totalTransactions": 5
    }
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## ✅ Test Scenarios

1. **List customers with various filters**
   - Test search by email, name
   - Test active/inactive filter
   - Test sorting options
   - Test pagination

2. **View customer details**
   - Verify statistics are calculated correctly
   - Check recent bookings are returned
   - Test with non-existent customer ID (should return 404)
   - Test with operator ID (should return 400 - not a customer)

3. **Update customer status**
   - Deactivate active customer
   - Activate inactive customer
   - Test with non-existent customer ID
   - Test with operator ID (should fail)

4. **Customer booking history**
   - Filter by status, date range
   - Test pagination
   - Verify only customer's bookings are returned

5. **Customer transactions**
   - Filter by transaction type
   - Filter by status
   - Verify totals are calculated correctly
   - Test with customer who has no transactions

---

## 🚨 Error Cases to Test

1. **404 Not Found**
   - Non-existent customer ID
   - Customer ID that doesn't exist in database

2. **400 Bad Request**
   - Invalid query parameters (e.g., `isActive=invalid`)
   - Trying to manage operator account as customer
   - Invalid transaction type or status

3. **401 Unauthorized**
   - No JWT token provided
   - Invalid/expired JWT token

4. **403 Forbidden**
   - Non-admin user trying to access endpoints
   - Customer or operator role trying to access admin endpoints

---

## 📊 Database Schema Used (No Changes)

All endpoints use ONLY existing fields:
- **User model**: id, email, firstName, lastName, phoneNumber, role, isActive, isEmailVerified, createdAt, updatedAt
- **Booking model**: All existing fields + relations
- **Transaction model**: All existing fields + relations
- **BookingGroup model**: All existing fields + relations

**No new fields, models, or migrations required!**

